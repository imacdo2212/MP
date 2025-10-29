import { createHash } from 'node:crypto';

import type { AuditFrame, AuditRecorderOptions } from '../audit/index.js';
import { recordAudit } from '../audit/index.js';
import type { EffectiveBudgets, ManifestConfig } from '../config/manifest.js';
import type { RefusalAliases } from '../shared/refusals.js';
import { resolveRefusalCode } from '../shared/refusals.js';
import { createExecId } from '../services/exec-id.js';

const NUMERIC_BUDGET_KEYS: (keyof EffectiveBudgets)[] = [
  'tokens_prompt_max',
  'tokens_output_max',
  'time_ms',
  'mem_mb',
  'depth_max',
  'clarifying_questions_max',
  'tools_max',
  'tool_calls_max',
  'web_requests_max',
  'code_exec_ms_max'
];

const CLARITY_BASELINE = -1.0;
const CLARITY_INCREMENT = 0.5;

export type NumericBudgetKey = (typeof NUMERIC_BUDGET_KEYS)[number];

export interface OrchestratorRequest {
  intent?: string;
  route?: string;
  payload?: Record<string, unknown> | null;
  hopsUsed?: number;
  clarityFacts?: number;
  budgetsConsumed?: Partial<Record<NumericBudgetKey, number>>;
  timestamp?: string | Date;
}

export interface OrchestratorSuccess {
  status: 'success';
  execId: string;
  route: string;
  clarityScore: number;
  hopCount: number;
  auditFrame: AuditFrame;
  budgets: EffectiveBudgets;
}

export interface OrchestratorRefusal {
  status: 'refusal';
  execId: string;
  route: string;
  clarityScore: number;
  hopCount: number;
  alias: string;
  code: string;
  reason: string;
  auditFrame: AuditFrame;
  overflowKeys?: NumericBudgetKey[];
}

export type OrchestratorResult = OrchestratorSuccess | OrchestratorRefusal;

export interface OrchestratorDependencies {
  manifestConfig: ManifestConfig;
  refusalAliases: RefusalAliases;
  auditOptions?: AuditRecorderOptions;
}

function normalizeTimestamp(value?: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

function sanitizeHopCount(hops?: number): number {
  if (typeof hops !== 'number' || Number.isNaN(hops)) {
    return 0;
  }
  return Math.max(0, Math.floor(hops));
}

function computeClarityScore(facts: number): number {
  return CLARITY_BASELINE + CLARITY_INCREMENT * facts;
}

function detectBudgetOverflow(
  consumption: Partial<Record<NumericBudgetKey, number>> | undefined,
  budgets: EffectiveBudgets
): NumericBudgetKey[] {
  if (!consumption) {
    return [];
  }

  const overflow: NumericBudgetKey[] = [];
  const numericBudgets = budgets as unknown as Record<NumericBudgetKey, number>;

  for (const key of NUMERIC_BUDGET_KEYS) {
    const used = consumption[key];
    const limit = numericBudgets[key];

    if (typeof used === 'number' && typeof limit === 'number' && used > limit) {
      overflow.push(key);
    }
  }

  return overflow;
}

function serializeBudgets(budgets: EffectiveBudgets): Record<string, unknown> {
  return JSON.parse(JSON.stringify(budgets)) as Record<string, unknown>;
}

function deriveRoute(config: ManifestConfig, intent?: string, explicitRoute?: string): string {
  if (explicitRoute) {
    return explicitRoute;
  }
  if (intent) {
    return config.getIntentRoute(intent);
  }
  return config.getIntentRoute('default');
}

function computeExecHash(payload: unknown): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(payload));
  return hash.digest('hex');
}

export class OrchestratorService {
  private readonly manifestConfig: ManifestConfig;
  private readonly refusalAliases: RefusalAliases;
  private readonly auditOptions?: AuditRecorderOptions;

  constructor(deps: OrchestratorDependencies) {
    this.manifestConfig = deps.manifestConfig;
    this.refusalAliases = deps.refusalAliases;
    this.auditOptions = deps.auditOptions;
  }

  private async record(frame: AuditFrame): Promise<void> {
    await recordAudit(frame, this.auditOptions);
  }

  async execute(request: OrchestratorRequest): Promise<OrchestratorResult> {
    const timestamp = normalizeTimestamp(request.timestamp);
    const hopCount = sanitizeHopCount(request.hopsUsed);
    const route = deriveRoute(this.manifestConfig, request.intent, request.route);
    const budgets = this.manifestConfig.resolveBudgets(route);
    const budgetsGranted = serializeBudgets(budgets);
    const budgetsConsumed = { ...(request.budgetsConsumed ?? {}) } as Record<string, unknown>;
    const clarityFacts = typeof request.clarityFacts === 'number' ? request.clarityFacts : 0;
    const clarityScore = computeClarityScore(clarityFacts);
    const overflowKeys = detectBudgetOverflow(request.budgetsConsumed, budgets);
    const accuracyGuards = this.manifestConfig.manifest.config.accuracy_guards;
    const clarityThreshold = accuracyGuards.bounded_outputs_only ? 0 : CLARITY_BASELINE;

    const execSeed = {
      route,
      hopCount,
      budgets: budgetsGranted,
      payload: request.payload ?? null,
      timestamp
    };
    const execId = createExecId(execSeed);

    const executedAt = new Date(timestamp);
    const terminationBase = executedAt;

    if (clarityScore < clarityThreshold) {
      const alias = 'ENTROPY_CLARITY';
      const code = resolveRefusalCode(alias, this.refusalAliases);
      const frame: AuditFrame = {
        execId,
        route,
        budgets: {
          granted: budgetsGranted,
          used: budgetsConsumed
        },
        termination: {
          status: 'failure',
          reason: code,
          at: terminationBase
        },
        createdAt: executedAt
      };
      await this.record(frame);
      return {
        status: 'refusal',
        execId,
        route,
        clarityScore,
        hopCount,
        alias,
        code,
        reason: 'clarity_score_below_threshold',
        auditFrame: frame
      };
    }

    const hopBounds = this.manifestConfig.manifest.routing.hop_bounds;
    if (hopCount > hopBounds.max_hops) {
      const alias = hopBounds.on_exceed || 'BOUND_DEPTH';
      const code = resolveRefusalCode(alias, this.refusalAliases);
      const frame: AuditFrame = {
        execId,
        route,
        budgets: {
          granted: budgetsGranted,
          used: budgetsConsumed
        },
        termination: {
          status: 'failure',
          reason: code,
          at: terminationBase
        },
        createdAt: executedAt
      };
      await this.record(frame);
      return {
        status: 'refusal',
        execId,
        route,
        clarityScore,
        hopCount,
        alias,
        code,
        reason: 'hop_bounds_exceeded',
        auditFrame: frame
      };
    }

    if (overflowKeys.length > 0) {
      const alias = 'BOUND_BUDGET';
      const code = resolveRefusalCode(alias, this.refusalAliases);
      const frame: AuditFrame = {
        execId,
        route,
        budgets: {
          granted: budgetsGranted,
          used: budgetsConsumed
        },
        termination: {
          status: 'failure',
          reason: code,
          at: terminationBase
        },
        createdAt: executedAt
      };
      await this.record(frame);
      return {
        status: 'refusal',
        execId,
        route,
        clarityScore,
        hopCount,
        alias,
        code,
        reason: 'budget_overflow',
        auditFrame: frame,
        overflowKeys
      };
    }

    const summaryHash = computeExecHash({
      clarityScore,
      hopCount,
      payload: request.payload ?? null,
      budgetsConsumed
    });
    const frame: AuditFrame = {
      execId,
      route,
      budgets: {
        granted: budgetsGranted,
        used: budgetsConsumed
      },
      termination: {
        status: 'success',
        reason: `bounded_output:${summaryHash}`,
        at: terminationBase
      },
      createdAt: executedAt
    };
    await this.record(frame);
    return {
      status: 'success',
      execId,
      route,
      clarityScore,
      hopCount,
      auditFrame: frame,
      budgets
    };
  }
}

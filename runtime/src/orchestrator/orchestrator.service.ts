import crypto from 'crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';

import type { BudgetDefaults, BudgetOverrides, Manifest } from '../config/manifest.js';
import { ManifestConfigService } from '../config/module.js';
import {
  CapabilityService,
  CapabilityUnavailableError
} from '../capabilities/capability.service.js';
import { AuditLedgerService } from '../db/audit-ledger.service.js';
import type { BudgetConsumption } from '../db/ledger.js';

export interface OrchestratorRequest {
  intent: string;
  payload?: unknown;
  callerBudgets?: BudgetOverrides;
  hopsTaken?: number;
  requestId?: string;
}

export interface OrchestratorResponse {
  execId: string;
  route: string;
  hopCount: number;
  terminationCode: string;
  refusal?: { code: string; reason: string };
  output?: Record<string, unknown>;
  budgets: { granted: BudgetDefaults; consumed: BudgetConsumption };
  metadata?: Record<string, unknown>;
}

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    @Inject(ManifestConfigService) private readonly manifest: ManifestConfigService,
    @Inject(CapabilityService) private readonly capabilities: CapabilityService,
    @Inject(AuditLedgerService) private readonly ledger: AuditLedgerService
  ) {}

  async execute(request: OrchestratorRequest): Promise<OrchestratorResponse> {
    const manifest = await this.manifest.getManifest();
    const intent = request.intent?.trim();
    const payload = request.payload ?? {};

    if (!intent) {
      const defaultBudgets = await this.manifest.resolveBudgets('mpa');
      return this.buildRefusalResponse({
        request,
        hopCount: (request.hopsTaken ?? 0) + 1,
        terminationCode: manifest.config.refusal_aliases.ENTROPY_CLARITY ?? 'REFUSAL(ENTROPY_CLARITY)',
        reason: 'Clarity gate rejected empty intent.',
        budgets: defaultBudgets
      });
    }

    const route = await this.manifest.getIntentRoute(intent);
    const baseBudgets = await this.manifest.resolveBudgets(route);
    const grantedBudgets = this.applyCallerBudgets(
      manifest.config.budget_policy,
      baseBudgets,
      request.callerBudgets
    );
    const hopCount = (request.hopsTaken ?? 0) + 1;

    if (hopCount > manifest.routing.hop_bounds.max_hops) {
      return this.buildRefusalResponse({
        request,
        hopCount,
        route,
        budgets: grantedBudgets,
        terminationCode: manifest.routing.hop_bounds.on_exceed,
        reason: 'Hop bound exceeded prior to execution.'
      });
    }

    const execId = this.createExecId(intent, payload, route, request.requestId);

    try {
      const capabilityResult = await this.capabilities.execute({
        intent,
        payload,
        route,
        budgets: grantedBudgets
      });

      const consumedBudgets = this.clampConsumption(capabilityResult.consumedBudgets, grantedBudgets);

      await this.ledger.record({
        execId,
        intent,
        route,
        hopCount,
        budgetsGranted: grantedBudgets,
        budgetsConsumed: consumedBudgets,
        terminationCode: capabilityResult.terminationCode,
        metadata: {
          ...capabilityResult.metadata,
          requestId: request.requestId ?? null
        }
      });

      return {
        execId,
        route,
        hopCount,
        terminationCode: capabilityResult.terminationCode,
        output: capabilityResult.output,
        budgets: {
          granted: grantedBudgets,
          consumed: consumedBudgets
        },
        metadata: capabilityResult.metadata
      };
    } catch (error) {
      const refusalCode = await this.resolveRefusalForError(error);
      this.logger.warn(`Execution failed for ${intent} → ${route}: ${String(error)}`);

      await this.ledger.record({
        execId,
        intent,
        route,
        hopCount,
        budgetsGranted: grantedBudgets,
        budgetsConsumed: {},
        terminationCode: refusalCode,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          requestId: request.requestId ?? null
        }
      });

      return {
        execId,
        route,
        hopCount,
        terminationCode: refusalCode,
        refusal: {
          code: refusalCode,
          reason: error instanceof Error ? error.message : 'Unknown capability failure.'
        },
        budgets: {
          granted: grantedBudgets,
          consumed: {}
        }
      };
    }
  }

  private async buildRefusalResponse({
    request,
    hopCount,
    route = 'mpa',
    budgets,
    terminationCode,
    reason
  }: {
    request: OrchestratorRequest;
    hopCount: number;
    route?: string;
    budgets: BudgetDefaults;
    terminationCode: string;
    reason: string;
  }): Promise<OrchestratorResponse> {
    const execId = this.createExecId(request.intent ?? '', request.payload ?? {}, route, request.requestId);

    try {
      await this.ledger.record({
        execId,
        intent: request.intent ?? '',
        route,
        hopCount,
        budgetsGranted: budgets,
        budgetsConsumed: {},
        terminationCode,
        metadata: {
          reason,
          requestId: request.requestId ?? null
        }
      });
    } catch (error) {
      this.logger.warn(`Failed to persist refusal audit frame: ${String(error)}`);
    }

    return {
      execId,
      route,
      hopCount,
      terminationCode,
      refusal: {
        code: terminationCode,
        reason
      },
      budgets: {
        granted: budgets,
        consumed: {}
      }
    };
  }

  private applyCallerBudgets(
    policy: Manifest['config']['budget_policy'],
    base: BudgetDefaults,
    overrides: BudgetOverrides | undefined
  ): BudgetDefaults {
    if (!overrides) {
      return base;
    }
    const merged: BudgetDefaults = { ...base };

    for (const key of Object.keys(overrides) as (keyof BudgetDefaults)[]) {
      const incoming = overrides[key];
      if (typeof incoming === 'undefined') {
        continue;
      }

      const current = merged[key];
      if (typeof current === 'number' && typeof incoming === 'number') {
        Reflect.set(
          merged,
          key,
          policy.caller_narrows ? Math.min(current, incoming) : incoming
        );
      } else {
        Reflect.set(merged, key, incoming as BudgetDefaults[typeof key]);
      }
    }

    return merged;
  }

  private clampConsumption(
    consumed: BudgetConsumption,
    granted: BudgetDefaults
  ): BudgetConsumption {
    const clamped: BudgetConsumption = {};

    for (const key of Object.keys(consumed) as (keyof BudgetDefaults)[]) {
      const value = consumed[key];
      if (typeof value === 'undefined') {
        continue;
      }

      const grant = granted[key];
      if (typeof value === 'number' && typeof grant === 'number') {
        Reflect.set(clamped, key, Math.min(value, grant));
      } else {
        Reflect.set(clamped, key, value as BudgetDefaults[typeof key]);
      }
    }

    return clamped;
  }

  private async resolveRefusalForError(error: unknown): Promise<string> {
    const manifest = await this.manifest.getManifest();
    const aliases = manifest.config.refusal_aliases;

    if (error instanceof CapabilityUnavailableError) {
      return aliases.DIS_INSUFFICIENT ?? 'REFUSAL(DIS_INSUFFICIENT)';
    }

    return aliases.FRAGILITY ?? 'REFUSAL(FRAGILITY)';
  }

  private createExecId(intent: string, payload: unknown, route: string, requestId?: string): string {
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(this.sortValue(payload)))
      .digest('hex');
    const base = requestId ?? `${intent}::${route}::${payloadHash}`;
    const digest = crypto.createHash('sha256').update(base).digest('hex').slice(0, 16);
    return `exec_${digest}`;
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortValue(item));
    }

    if (value && typeof value === 'object' && value.constructor === Object) {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = this.sortValue((value as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }

    return value;
  }
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

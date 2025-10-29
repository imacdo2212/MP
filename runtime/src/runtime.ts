import crypto from 'crypto';
import {
  loadManifestConfig,
  type BudgetDefaults,
  type BudgetOverrides,
  type EffectiveBudgets,
  type ManifestConfig
} from './config/manifest.js';

type ClampPolicy = ManifestConfig['manifest']['config']['budget_policy']['route_profile_clamp'];

const NUMERIC_BUDGET_KEYS: (keyof BudgetDefaults)[] = [
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

type NumericBudgetKey = (typeof NUMERIC_BUDGET_KEYS)[number];

export interface SimulationOptions {
  intent?: string;
  routeOverride?: string;
  callerBudgets?: Partial<BudgetOverrides>;
  hopsUsed?: number;
  consumption?: Partial<Record<NumericBudgetKey, number>>;
  execId?: string;
}

export interface AuditPayload {
  execId: string;
  route: string;
  budgets: EffectiveBudgets;
  clampPolicy: ClampPolicy;
  termination: string;
  metrics: Record<string, unknown>;
}

export interface AuditEntry extends AuditPayload {
  prevHash: string;
  hash: string;
}

export class AuditLedger {
  private readonly entries: AuditEntry[] = [];

  append(payload: AuditPayload): AuditEntry {
    const prevHash = this.entries.length ? this.entries[this.entries.length - 1].hash : 'GENESIS';
    const serialized = JSON.stringify({ ...payload, prevHash });
    const hash = crypto.createHash('sha256').update(serialized).digest('hex');
    const entry: AuditEntry = { ...payload, prevHash, hash };
    this.entries.push(entry);
    return entry;
  }

  getEntries(): readonly AuditEntry[] {
    return this.entries;
  }

  verify(): boolean {
    let expectedPrev = 'GENESIS';

    for (const entry of this.entries) {
      if (entry.prevHash !== expectedPrev) {
        return false;
      }

      const serialized = JSON.stringify({
        execId: entry.execId,
        route: entry.route,
        budgets: entry.budgets,
        clampPolicy: entry.clampPolicy,
        termination: entry.termination,
        metrics: entry.metrics,
        prevHash: entry.prevHash
      });
      const recalculated = crypto.createHash('sha256').update(serialized).digest('hex');

      if (recalculated !== entry.hash) {
        return false;
      }

      expectedPrev = entry.hash;
    }

    return true;
  }
}

function applyCallerBudgets(
  budgets: EffectiveBudgets,
  overrides: Partial<BudgetOverrides> | undefined,
  clampPolicy: ClampPolicy,
  callerNarrows: boolean
): EffectiveBudgets {
  if (!overrides || Object.keys(overrides).length === 0) {
    return budgets;
  }

  const narrowed: EffectiveBudgets = { ...budgets };
  const numericBudgets = narrowed as unknown as Record<NumericBudgetKey, number>;

  for (const key of NUMERIC_BUDGET_KEYS) {
    const overrideValue = overrides[key];
    const current = numericBudgets[key];

    if (typeof overrideValue !== 'number' || typeof current !== 'number') {
      continue;
    }

    if (callerNarrows || clampPolicy === 'min') {
      numericBudgets[key] = Math.min(current, overrideValue);
      continue;
    }

    if (clampPolicy === 'max') {
      numericBudgets[key] = Math.max(current, overrideValue);
      continue;
    }

    numericBudgets[key] = overrideValue;
  }

  if (typeof overrides.citations_required === 'boolean') {
    narrowed.citations_required = overrides.citations_required;
  }

  if (typeof overrides.cot_visibility === 'string') {
    narrowed.cot_visibility = overrides.cot_visibility;
  }

  return narrowed;
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

export type SimulationResult =
  | {
      kind: 'BOUNDED_OUTPUT';
      route: string;
      budgets: EffectiveBudgets;
      ledgerEntry: AuditEntry;
    }
  | {
      kind: 'REFUSAL';
      code: string;
      route: string;
      budgets: EffectiveBudgets;
      ledgerEntry: AuditEntry;
      overflowKeys?: NumericBudgetKey[];
      alias?: string;
    };

export class RuntimeEngine {
  constructor(private readonly config: ManifestConfig, private readonly ledger: AuditLedger = new AuditLedger()) {}

  getLedger(): AuditLedger {
    return this.ledger;
  }

  simulateRoutedRequest(options: SimulationOptions): SimulationResult {
    const { manifest } = this.config;
    const clampPolicy = manifest.config.budget_policy.route_profile_clamp;
    const callerNarrows = manifest.config.budget_policy.caller_narrows;

    const route = options.routeOverride ?? this.resolveRoute(options.intent);
    const execId = options.execId ?? crypto.randomUUID();
    const hopsUsed = options.hopsUsed ?? 0;

    const budgets = this.config.resolveBudgets(route);
    const effectiveBudgets = applyCallerBudgets(budgets, options.callerBudgets, clampPolicy, callerNarrows);

    if (hopsUsed > manifest.routing.hop_bounds.max_hops) {
      const termination = manifest.routing.hop_bounds.on_exceed;
      const ledgerEntry = this.ledger.append({
        execId,
        route,
        budgets: effectiveBudgets,
        clampPolicy,
        termination,
        metrics: {
          hopsUsed,
          maxHops: manifest.routing.hop_bounds.max_hops,
          reason: 'hop_bounds_exceeded'
        }
      });

      return {
        kind: 'REFUSAL',
        code: termination,
        route,
        budgets: effectiveBudgets,
        ledgerEntry
      };
    }

    const overflowKeys = detectBudgetOverflow(options.consumption, effectiveBudgets);

    if (overflowKeys.length > 0) {
      const alias = manifest.config.refusal_aliases.BOUND_BUDGET ?? 'BOUND_BUDGET';
      const termination = `REFUSAL(${alias})`;
      const ledgerEntry = this.ledger.append({
        execId,
        route,
        budgets: effectiveBudgets,
        clampPolicy,
        termination,
        metrics: {
          hopsUsed,
          overflowKeys,
          consumption: options.consumption ?? {},
          reason: 'budget_overflow'
        }
      });

      return {
        kind: 'REFUSAL',
        code: termination,
        route,
        budgets: effectiveBudgets,
        ledgerEntry,
        overflowKeys,
        alias
      };
    }

    const ledgerEntry = this.ledger.append({
      execId,
      route,
      budgets: effectiveBudgets,
      clampPolicy,
      termination: 'BOUNDED_OUTPUT',
      metrics: {
        hopsUsed,
        consumption: options.consumption ?? {},
        callerBudgets: options.callerBudgets ?? {}
      }
    });

    return {
      kind: 'BOUNDED_OUTPUT',
      route,
      budgets: effectiveBudgets,
      ledgerEntry
    };
  }

  private resolveRoute(intent?: string): string {
    if (!intent) {
      return this.config.getIntentRoute('');
    }

    return this.config.getIntentRoute(intent);
  }
}

export async function createRuntime(manifestPath?: string, ledger?: AuditLedger): Promise<RuntimeEngine> {
  const config = await loadManifestConfig(manifestPath);
  return new RuntimeEngine(config, ledger);
}

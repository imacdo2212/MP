import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const moduleDir = fileURLToPath(new URL('.', import.meta.url));

const budgetNumberSchema = z.number().int().nonnegative();

export interface BudgetDefaults {
  tokens_prompt_max: number;
  tokens_output_max: number;
  time_ms: number;
  mem_mb: number;
  depth_max: number;
  clarifying_questions_max: number;
  tools_max: number;
  tool_calls_max: number;
  web_requests_max: number;
  code_exec_ms_max: number;
  citations_required: boolean;
  cot_visibility: string;
}

const budgetsDefaultsSchema: z.ZodType<BudgetDefaults> = z.object({
  tokens_prompt_max: budgetNumberSchema,
  tokens_output_max: budgetNumberSchema,
  time_ms: budgetNumberSchema,
  mem_mb: budgetNumberSchema,
  depth_max: budgetNumberSchema,
  clarifying_questions_max: budgetNumberSchema,
  tools_max: budgetNumberSchema,
  tool_calls_max: budgetNumberSchema,
  web_requests_max: budgetNumberSchema,
  code_exec_ms_max: budgetNumberSchema,
  citations_required: z.boolean(),
  cot_visibility: z.string()
});

export const budgetOverridesSchema = z.object({
  tokens_prompt_max: budgetNumberSchema.optional(),
  tokens_output_max: budgetNumberSchema.optional(),
  time_ms: budgetNumberSchema.optional(),
  mem_mb: budgetNumberSchema.optional(),
  depth_max: budgetNumberSchema.optional(),
  clarifying_questions_max: budgetNumberSchema.optional(),
  tools_max: budgetNumberSchema.optional(),
  tool_calls_max: budgetNumberSchema.optional(),
  web_requests_max: budgetNumberSchema.optional(),
  code_exec_ms_max: budgetNumberSchema.optional(),
  citations_required: z.boolean().optional(),
  cot_visibility: z.string().optional()
});

const budgetPolicySchema = z.object({
  caller_narrows: z.boolean(),
  route_profile_clamp: z.enum(['min', 'max', 'override']).default('min'),
  on_overflow: z.string()
});

const accuracyGuardsSchema = z.object({
  bounded_outputs_only: z.boolean(),
  no_invention_beyond_inputs: z.boolean(),
  hierarchy: z.string(),
  escalation_rule: z.string()
});

const manifestSchema = z.object({
  name: z.string(),
  version: z.string(),
  generated: z.string(),
  description: z.string(),
  imports: z.array(z.string()),
  config: z.object({
    budgets_defaults: budgetsDefaultsSchema,
    budget_policy: budgetPolicySchema,
    accuracy_guards: accuracyGuardsSchema,
    refusal_aliases: z.record(z.string())
  }),
  route_budgets: z.record(budgetOverridesSchema),
  routing: z.object({
    policy: z.string(),
    intent_map: z.record(z.string()),
    hop_bounds: z.object({
      max_hops: budgetNumberSchema,
      on_exceed: z.string()
    })
  }),
  acceptance_tests: z.record(z.string())
});

export type Manifest = z.infer<typeof manifestSchema>;
export type BudgetOverrides = Partial<BudgetDefaults>;
type BudgetKey = keyof BudgetDefaults;
type BudgetValue = BudgetDefaults[BudgetKey];

export type EffectiveBudgets = BudgetDefaults;

export interface ManifestConfig {
  manifest: Manifest;
  resolveBudgets: (route: string) => EffectiveBudgets;
  getIntentRoute: (intent: string) => string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split('*')
    .map((segment) => escapeRegex(segment))
    .join('.*');
  return new RegExp(`^${escaped}$`, 'i');
}

function buildRouteBudgetTable(manifest: Manifest) {
  return Object.entries(manifest.route_budgets).map(([pattern, overrides]) => ({
    pattern,
    matcher: wildcardToRegExp(pattern),
    overrides
  }));
}

function applyClamp(
  current: number,
  incoming: number,
  clamp: Manifest['config']['budget_policy']['route_profile_clamp']
): number {
  switch (clamp) {
    case 'min':
      return Math.min(current, incoming);
    case 'max':
      return Math.max(current, incoming);
    case 'override':
    default:
      return incoming;
  }
}

function mergeBudgets(
  base: BudgetDefaults,
  overrides: BudgetOverrides,
  clamp: Manifest['config']['budget_policy']['route_profile_clamp'],
  overriddenKeys: Set<BudgetKey>
): EffectiveBudgets {
  const merged: Record<BudgetKey, BudgetValue> = { ...base };

  for (const key of Object.keys(overrides) as BudgetKey[]) {
    const value = overrides[key];
    if (typeof value === 'undefined') {
      continue;
    }

    const current = merged[key];
    if (typeof current === 'number' && typeof value === 'number') {
      if (overriddenKeys.has(key)) {
        merged[key] = applyClamp(current, value, clamp) as BudgetValue;
      } else {
        merged[key] = value as BudgetValue;
        overriddenKeys.add(key);
      }
    } else {
      merged[key] = value as BudgetValue;
      overriddenKeys.add(key);
    }
  }

  return merged as BudgetDefaults;
}

function normalizeIntent(value: string): string {
  return value.trim().toLowerCase();
}

function selectIntentRoute(manifest: Manifest, intent: string): string {
  const normalizedIntent = normalizeIntent(intent);
  const entries = Object.entries(manifest.routing.intent_map);
  const defaultRoute = manifest.routing.intent_map.default ?? 'mpa';

  for (const [pattern, route] of entries) {
    if (pattern === 'default') {
      continue;
    }

    const variants = pattern.split('|').map((variant) => variant.trim());
    for (const variant of variants) {
      if (!variant) {
        continue;
      }

      if (variant.includes('*')) {
        const regex = wildcardToRegExp(variant);
        if (regex.test(normalizedIntent)) {
          return route;
        }
        continue;
      }

      if (
        normalizedIntent === normalizeIntent(variant) ||
        normalizedIntent.includes(normalizeIntent(variant))
      ) {
        return route;
      }
    }
  }

  return defaultRoute;
}

export async function loadManifest(
  manifestPath: string = path.resolve(moduleDir, '../../../Additionals/Manifest.json')
): Promise<Manifest> {
  const raw = await fs.readFile(manifestPath, 'utf8');
  const json = JSON.parse(raw);
  return manifestSchema.parse(json);
}

export async function loadManifestConfig(
  manifestPath?: string
): Promise<ManifestConfig> {
  const manifest = await loadManifest(manifestPath);
  const routeBudgets = buildRouteBudgetTable(manifest);
  const defaults = manifest.config.budgets_defaults;
  const clamp = manifest.config.budget_policy.route_profile_clamp;

  return {
    manifest,
    resolveBudgets(route: string) {
      const routeId = normalizeIntent(route);
      const overriddenKeys = new Set<BudgetKey>();
      return routeBudgets
        .filter(({ matcher }) => matcher.test(routeId))
        .reduce<EffectiveBudgets>(
          (acc, { overrides }) => mergeBudgets(acc, overrides, clamp, overriddenKeys),
          { ...defaults }
        );
    },
    getIntentRoute(intent: string) {
      return selectIntentRoute(manifest, intent);
    }
  };
}

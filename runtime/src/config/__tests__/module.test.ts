import assert from 'node:assert/strict';
import test from 'node:test';

import { ConfigModule } from '../module.js';
import { createManifestConfig, Manifest } from '../manifest.js';

const baseManifest: Manifest = {
  name: 'test-manifest',
  version: '1.0.0',
  generated: '2024-01-01T00:00:00Z',
  description: 'Synthetic manifest for testing',
  imports: [],
  config: {
    budgets_defaults: {
      tokens_prompt_max: 100,
      tokens_output_max: 50,
      time_ms: 1000,
      mem_mb: 256,
      depth_max: 4,
      clarifying_questions_max: 2,
      tools_max: 5,
      tool_calls_max: 5,
      web_requests_max: 3,
      code_exec_ms_max: 5000,
      citations_required: false,
      cot_visibility: 'summary'
    },
    budget_policy: {
      caller_narrows: true,
      route_profile_clamp: 'min',
      on_overflow: 'halt'
    },
    accuracy_guards: {
      bounded_outputs_only: true,
      no_invention_beyond_inputs: true,
      hierarchy: 'test',
      escalation_rule: 'notify'
    },
    refusal_aliases: {}
  },
  route_budgets: {},
  routing: {
    policy: 'deterministic',
    intent_map: { default: 'mpa.default' },
    hop_bounds: {
      max_hops: 3,
      on_exceed: 'fail'
    }
  },
  acceptance_tests: {}
};

function buildManifest(overrides: Partial<Manifest>): Manifest {
  return {
    ...baseManifest,
    ...overrides,
    config: {
      ...baseManifest.config,
      ...overrides.config,
      budgets_defaults: {
        ...baseManifest.config.budgets_defaults,
        ...(overrides.config?.budgets_defaults ?? {})
      },
      budget_policy: {
        ...baseManifest.config.budget_policy,
        ...(overrides.config?.budget_policy ?? {})
      },
      accuracy_guards: {
        ...baseManifest.config.accuracy_guards,
        ...(overrides.config?.accuracy_guards ?? {})
      },
      refusal_aliases: {
        ...baseManifest.config.refusal_aliases,
        ...(overrides.config?.refusal_aliases ?? {})
      }
    },
    route_budgets: {
      ...baseManifest.route_budgets,
      ...(overrides.route_budgets ?? {})
    },
    routing: {
      ...baseManifest.routing,
      ...overrides.routing,
      intent_map: {
        ...baseManifest.routing.intent_map,
        ...(overrides.routing?.intent_map ?? {})
      },
      hop_bounds: {
        ...baseManifest.routing.hop_bounds,
        ...(overrides.routing?.hop_bounds ?? {})
      }
    },
    acceptance_tests: {
      ...baseManifest.acceptance_tests,
      ...(overrides.acceptance_tests ?? {})
    }
  };
}

test('selects routes using wildcard patterns deterministically', () => {
  const manifest = buildManifest({
    routing: {
      policy: 'deterministic',
      intent_map: {
        default: 'mpa.default',
        'legal*': 'mpa.legal',
        'tax review|tax prep': 'mpa.tax'
      },
      hop_bounds: {
        max_hops: 3,
        on_exceed: 'fail'
      }
    }
  });

  const config = createManifestConfig(manifest);

  assert.equal(config.getIntentRoute('LEGAL contract review'), 'mpa.legal');
  assert.equal(config.getIntentRoute('tax review services'), 'mpa.tax');
  assert.equal(config.getIntentRoute('unknown request'), 'mpa.default');

  // repeated calls should yield identical answers
  assert.equal(config.getIntentRoute('legal compliance'), 'mpa.legal');
  assert.equal(config.getIntentRoute('legal compliance'), 'mpa.legal');
});

test('applies route_profile_clamp policy deterministically', () => {
  const minClampManifest = buildManifest({
    config: {
      ...baseManifest.config,
      budget_policy: {
        ...baseManifest.config.budget_policy,
        route_profile_clamp: 'min',
        on_overflow: 'halt'
      }
    },
    route_budgets: {
      'mpa.legal': {
        tokens_prompt_max: 200,
        tokens_output_max: 25,
        depth_max: 10,
        cot_visibility: 'full'
      }
    }
  });

  const minClampConfig = createManifestConfig(minClampManifest);
  const first = minClampConfig.resolveBudgets('mpa.legal');
  const second = minClampConfig.resolveBudgets('mpa.legal');

  assert.deepEqual(first, second);
  assert.equal(first.tokens_prompt_max, 100);
  assert.equal(first.tokens_output_max, 25);
  assert.equal(first.depth_max, 4);
  assert.equal(first.cot_visibility, 'full');

  const maxClampManifest: Manifest = {
    ...minClampManifest,
    config: {
      ...minClampManifest.config,
      budget_policy: {
        ...minClampManifest.config.budget_policy,
        route_profile_clamp: 'max'
      }
    }
  };

  const maxClampConfig = createManifestConfig(maxClampManifest);
  const resolved = maxClampConfig.resolveBudgets('mpa.legal');

  assert.equal(resolved.tokens_prompt_max, 200);
  assert.equal(resolved.tokens_output_max, 50);
});

test('ConfigModule exposes manifest helpers after bootstrap', async () => {
  ConfigModule.reset();
  const manifest = buildManifest({
    route_budgets: {
      'mpa.special': { tokens_prompt_max: 150 }
    }
  });

  await ConfigModule.bootstrap({ manifest });

  assert.equal(ConfigModule.getIntentRoute('other'), 'mpa.default');
  assert.equal(ConfigModule.resolveBudgets('mpa.special').tokens_prompt_max, 100);
  assert.equal(ConfigModule.manifest.name, 'test-manifest');
});

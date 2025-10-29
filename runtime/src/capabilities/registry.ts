import { resolveRefusalCode } from '../shared/refusals.js';
import type { RefusalAliases } from '../shared/refusals.js';
import type { RequestContext } from '../server/request-context.js';
import type {
  CapabilityAdapter,
  CapabilityInvocation,
  CapabilityResult
} from './base.js';

interface FixturePayload {
  summary: string;
  data: Record<string, unknown>;
}

interface FixtureConfig {
  success: FixturePayload;
  description: string;
}

const FAILURE_ALIAS_MAP = {
  timeout: 'TOOL_TIMEOUT',
  failure: 'TOOL_FAIL',
  unsafe: 'TOOL_UNSAFE',
  schema_miss: 'TOOL_SCHEMA_MISS',
  drift: 'TOOL_DRIFT'
} as const;

function createFixtureAdapter(
  name: string,
  fixture: FixtureConfig,
  refusalAliases: RefusalAliases
): CapabilityAdapter {
  return async (invocation: CapabilityInvocation, context: RequestContext): Promise<CapabilityResult> => {
    const scenario = invocation.scenario ?? 'success';
    if (scenario === 'success') {
      return {
        ok: true,
        data: {
          capability: name,
          route: context.route,
          ...fixture.success
        }
      };
    }

    const aliasKey = FAILURE_ALIAS_MAP[scenario as keyof typeof FAILURE_ALIAS_MAP];
    const alias = aliasKey ?? 'TOOL_FAIL';
    const code = resolveRefusalCode(alias, refusalAliases);
    return {
      ok: false,
      refusal: {
        alias,
        code,
        reason: `${name} adapter simulated ${scenario} scenario`
      }
    };
  };
}

export interface CapabilityRegistry {
  invoke(name: string, invocation: CapabilityInvocation, context: RequestContext): Promise<CapabilityResult>;
  knownCapabilities(): string[];
}

export function buildCapabilityRegistry(refusalAliases: RefusalAliases): CapabilityRegistry {
  const fixtures: Record<string, FixtureConfig> = {
    legalSearch: {
      description: 'Static search over curated legal holdings',
      success: {
        summary: 'Found 2 precedent matches with relevance ≥0.84',
        data: {
          precedents: [
            { id: 'case-1984-01', title: 'Rumpole v. Apex', score: 0.91 },
            { id: 'case-1996-18', title: 'MPA Holdings v. Contoso', score: 0.84 }
          ]
        }
      }
    },
    complianceScanner: {
      description: 'Placeholder compliance risk scan',
      success: {
        summary: 'Risk posture nominal with 1 advisory flag',
        data: {
          advisories: [{ id: 'adv-14', severity: 'medium', detail: 'Renew SOC2 evidence within 30 days' }]
        }
      }
    }
  };

  const adapters: Record<string, CapabilityAdapter> = Object.fromEntries(
    Object.entries(fixtures).map(([name, fixture]) => [name, createFixtureAdapter(name, fixture, refusalAliases)])
  );

  return {
    async invoke(name: string, invocation: CapabilityInvocation, context: RequestContext): Promise<CapabilityResult> {
      const adapter = adapters[name];
      if (!adapter) {
        const alias = 'DIS_INSUFFICIENT';
        const code = resolveRefusalCode(alias, refusalAliases);
        return {
          ok: false,
          refusal: {
            alias,
            code,
            reason: `No capability adapter registered for "${name}"`
          }
        };
      }

      return adapter(invocation, context);
    },
    knownCapabilities(): string[] {
      return Object.keys(adapters);
    }
  };
}

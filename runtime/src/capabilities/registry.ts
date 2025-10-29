import { resolveRefusalCode } from '../shared/refusals.js';
import type { RefusalAliases } from '../shared/refusals.js';
import type { RequestContext } from '../server/request-context.js';
import type {
  CapabilityAdapter,
  CapabilityInvocation,
  CapabilityResult
} from './base.js';
import {
  COMPLIANCE_SCANNER_CAPABILITY,
  COMPLIANCE_SCANNER_FIXTURE,
  type ComplianceScannerCapabilityName
} from './compliance-scanner.js';
import { CapabilityModesConfig, CapabilityMode, resolveCapabilityMode } from './config.js';
import {
  LEGAL_SEARCH_CAPABILITY,
  LEGAL_SEARCH_FIXTURE,
  type LegalSearchCapabilityName
} from './legal-search.js';

interface FixturePayload {
  summary: string;
  data: Record<string, unknown>;
}

interface FixtureConfig {
  success: FixturePayload;
  description: string;
}

type KnownCapabilityName = LegalSearchCapabilityName | ComplianceScannerCapabilityName;

const FAILURE_ALIAS_MAP = {
  timeout: 'TOOL_TIMEOUT',
  failure: 'TOOL_FAIL',
  unsafe: 'TOOL_UNSAFE',
  schema_miss: 'TOOL_SCHEMA_MISS',
  drift: 'TOOL_DRIFT'
} as const;

const CAPABILITY_FIXTURES: Record<KnownCapabilityName, FixtureConfig> = {
  [LEGAL_SEARCH_CAPABILITY]: {
    description: 'Static search over curated legal holdings',
    success: {
      summary: LEGAL_SEARCH_FIXTURE.summary,
      data: LEGAL_SEARCH_FIXTURE.data
    }
  },
  [COMPLIANCE_SCANNER_CAPABILITY]: {
    description: 'Placeholder compliance risk scan',
    success: {
      summary: COMPLIANCE_SCANNER_FIXTURE.summary,
      data: COMPLIANCE_SCANNER_FIXTURE.data
    }
  }
};

function createDisabledAdapter(
  name: KnownCapabilityName,
  refusalAliases: RefusalAliases
): CapabilityAdapter {
  return async () => ({
    ok: false,
    refusal: {
      alias: 'DIS_INSUFFICIENT',
      code: resolveRefusalCode('DIS_INSUFFICIENT', refusalAliases),
      reason: `${name} capability disabled via configuration`
    }
  });
}

function createFixtureAdapter(
  name: KnownCapabilityName,
  fixture: FixtureConfig,
  refusalAliases: RefusalAliases
): CapabilityAdapter {
  return async (
    invocation: CapabilityInvocation,
    context: RequestContext
  ): Promise<CapabilityResult> => {
    const scenario = invocation.scenario ?? 'success';
    if (scenario === 'success') {
      return {
        ok: true,
        data: {
          capability: name,
          route: context.route,
          description: fixture.description,
          summary: fixture.success.summary,
          payloadEcho: invocation.payload ?? null,
          ...fixture.success.data
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

export interface CapabilityRegistryOptions {
  modes?: CapabilityModesConfig<KnownCapabilityName>;
  overrides?: Partial<Record<KnownCapabilityName, CapabilityAdapter>>;
}

export interface CapabilityRegistry {
  invoke(name: string, invocation: CapabilityInvocation, context: RequestContext): Promise<CapabilityResult>;
  knownCapabilities(): string[];
}

function resolveMode(
  name: KnownCapabilityName,
  options?: CapabilityRegistryOptions
): CapabilityMode {
  const explicit = options?.modes?.[name];
  return resolveCapabilityMode(name, explicit);
}

export function buildCapabilityRegistry(
  refusalAliases: RefusalAliases,
  options: CapabilityRegistryOptions = {}
): CapabilityRegistry {
  const adapters: Record<string, CapabilityAdapter> = {};

  (Object.keys(CAPABILITY_FIXTURES) as KnownCapabilityName[]).forEach((name) => {
    const override = options.overrides?.[name];
    if (override) {
      adapters[name] = override;
      return;
    }

    const mode = resolveMode(name, options);
    if (mode === 'disabled') {
      adapters[name] = createDisabledAdapter(name, refusalAliases);
      return;
    }

    if (mode === 'live') {
      throw new Error(
        `Capability "${name}" is configured for live mode but no adapter override was provided.`
      );
    }

    adapters[name] = createFixtureAdapter(name, CAPABILITY_FIXTURES[name], refusalAliases);
  });

  return {
    async invoke(
      name: string,
      invocation: CapabilityInvocation,
      context: RequestContext
    ): Promise<CapabilityResult> {
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

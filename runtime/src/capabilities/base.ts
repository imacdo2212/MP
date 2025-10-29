import type { RequestContext } from '../server/request-context.js';

export type CapabilityScenario =
  | 'success'
  | 'timeout'
  | 'failure'
  | 'unsafe'
  | 'schema_miss'
  | 'drift';

export interface CapabilityInvocation {
  name: string;
  scenario?: CapabilityScenario;
  payload?: Record<string, unknown>;
}

export interface CapabilityRefusal {
  alias: string;
  code: string;
  reason: string;
}

export interface CapabilityResult {
  ok: boolean;
  data?: unknown;
  refusal?: CapabilityRefusal;
}

export type CapabilityAdapter = (
  invocation: CapabilityInvocation,
  context: RequestContext
) => Promise<CapabilityResult>;

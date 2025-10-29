import type { ManifestConfig, EffectiveBudgets } from '../config/manifest.js';
import type { RefusalAliases } from '../shared/refusals.js';
import { resolveRefusalCode } from '../shared/refusals.js';
import { createExecId } from '../services/exec-id.js';
import type { AuditRecord, HopBounds } from '../services/audit.js';
import { summarizeAudit } from '../services/audit.js';
import type { CapabilityScenario } from '../capabilities/base.js';

export interface IngressCapabilityRequest {
  name: string;
  scenario?: CapabilityScenario;
  payload?: Record<string, unknown>;
}

export interface IngressRequestBody {
  intent?: string;
  route?: string;
  hops?: number;
  payload?: Record<string, unknown>;
  timestamp?: string;
  capabilities?: IngressCapabilityRequest[];
}

export interface RequestContext {
  execId: string;
  route: string;
  hopCount: number;
  budgets: EffectiveBudgets;
  hopBounds: HopBounds;
  refusalAliases: RefusalAliases;
  manifestConfig: ManifestConfig;
  audit: AuditRecord;
}

function sanitizeHopCount(hops?: number): number {
  if (typeof hops !== 'number' || Number.isNaN(hops)) {
    return 0;
  }
  return Math.max(0, Math.floor(hops));
}

function deriveRoute(manifestConfig: ManifestConfig, body: IngressRequestBody): string {
  if (body.route) {
    return body.route;
  }
  if (body.intent) {
    return manifestConfig.getIntentRoute(body.intent);
  }
  return manifestConfig.getIntentRoute('default');
}

function buildHopBounds(manifestConfig: ManifestConfig): HopBounds {
  const manifestBounds = manifestConfig.manifest.routing.hop_bounds;
  const alias = manifestBounds.on_exceed || 'BOUND_DEPTH';
  return {
    maxHops: manifestBounds.max_hops,
    codeAlias: alias
  };
}

function resolveRequestedAt(value?: string): string {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

export function createRequestContext(
  manifestConfig: ManifestConfig,
  refusalAliases: RefusalAliases,
  body: IngressRequestBody
): RequestContext {
  const route = deriveRoute(manifestConfig, body);
  const hopCount = sanitizeHopCount(body.hops);
  const budgets = manifestConfig.resolveBudgets(route);
  const hopBounds = buildHopBounds(manifestConfig);
  const requestedAt = resolveRequestedAt(body.timestamp);
  const execId = createExecId({
    route,
    hopCount,
    budgets,
    payload: body.payload ?? null,
    timestamp: requestedAt
  });

  const audit: AuditRecord = {
    execId,
    route,
    hopCount,
    hopBounds: {
      maxHops: hopBounds.maxHops,
      codeAlias: hopBounds.codeAlias
    },
    budgets,
    requestedAt,
    capabilityResults: []
  };

  return {
    execId,
    route,
    hopCount,
    budgets,
    hopBounds,
    refusalAliases,
    manifestConfig,
    audit
  };
}

export function finalizeWithRefusal(
  ctx: RequestContext,
  reason: string,
  diagnostics?: Record<string, unknown>
) {
  const code = resolveRefusalCode(ctx.hopBounds.codeAlias, ctx.refusalAliases);
  ctx.audit.termination = {
    kind: 'REFUSAL',
    code,
    reason,
    diagnostics
  };
  return {
    status: 'refusal' as const,
    code,
    alias: ctx.hopBounds.codeAlias,
    reason,
    diagnostics,
    audit: summarizeAudit(ctx.audit)
  };
}

export function finalizeWithSuccess(ctx: RequestContext, summary: string) {
  ctx.audit.termination = {
    kind: 'BOUNDED_OUTPUT',
    summary
  };
  return {
    status: 'ok' as const,
    route: ctx.route,
    budgets: ctx.budgets,
    hopBounds: ctx.hopBounds,
    audit: summarizeAudit(ctx.audit)
  };
}

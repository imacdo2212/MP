import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ManifestConfig } from '../../config/manifest.js';
import type { RefusalAliases } from '../../shared/refusals.js';
import type { CapabilityRegistry } from '../../capabilities/registry.js';
import type { AuditWriter, CapabilityAuditEntry } from '../../services/audit.js';
import { summarizeAudit } from '../../services/audit.js';
import {
  createRequestContext,
  finalizeWithRefusal,
  finalizeWithSuccess,
  type IngressRequestBody
} from '../request-context.js';
import { resolveRefusalCode } from '../../shared/refusals.js';

interface RouteDependencies {
  manifestConfig: ManifestConfig;
  refusalAliases: RefusalAliases;
  capabilityRegistry: CapabilityRegistry;
  auditWriter: AuditWriter;
}

interface IngressReply {
  status: 'ok' | 'refusal';
  [key: string]: unknown;
}

async function executeWithAudit(
  request: FastifyRequest<{ Body: IngressRequestBody }>,
  reply: FastifyReply,
  deps: RouteDependencies,
  handler: () => Promise<IngressReply>
): Promise<IngressReply> {
  let result: IngressReply;

  try {
    result = await handler();
  } catch (error) {
    const ctx = request.ctx;
    if (ctx && !ctx.audit.termination) {
      const code = resolveRefusalCode('TOOL_FAIL', deps.refusalAliases);
      ctx.audit.termination = {
        kind: 'REFUSAL',
        code,
        reason: error instanceof Error ? error.message : 'Unhandled error'
      };
    }

    if (request.ctx) {
      try {
        await deps.auditWriter.write(request.ctx.audit);
      } catch (writeError) {
        request.log.error({ err: writeError }, 'audit.write.failed');
      }
    }

    throw error;
  }

  if (!request.ctx) {
    return result;
  }

  try {
    await deps.auditWriter.write(request.ctx.audit);
    return result;
  } catch (error) {
    request.log.error({ err: error }, 'audit.write.failed');
    const code = resolveRefusalCode('TOOL_FAIL', deps.refusalAliases);
    const reason = 'Audit ledger unavailable';
    request.ctx.audit.termination = {
      kind: 'REFUSAL',
      code,
      reason
    };
    reply.status(503);
    return {
      status: 'refusal' as const,
      code,
      alias: 'TOOL_FAIL',
      reason,
      audit: summarizeAudit(request.ctx.audit)
    };
  }
}

export function registerIngressRoute(app: FastifyInstance, deps: RouteDependencies) {
  app.post<{ Body: IngressRequestBody }>('/ingress', async (request, reply) => {
    return executeWithAudit(request, reply, deps, async () => {
      const body = (request.body ?? {}) as IngressRequestBody;
      request.ctx = createRequestContext(deps.manifestConfig, deps.refusalAliases, body);
      const ctx = request.ctx;
      const hopBounds = ctx.hopBounds;

      if (ctx.hopCount > hopBounds.maxHops) {
        reply.status(429);
        return finalizeWithRefusal(ctx, `Hop count ${ctx.hopCount} exceeds max ${hopBounds.maxHops}`, {
          hopCount: ctx.hopCount,
          maxHops: hopBounds.maxHops
        });
      }

      const capabilityResults: CapabilityAuditEntry[] = [];
      const capabilities = request.body?.capabilities ?? [];

      for (const invocation of capabilities) {
        const result = await deps.capabilityRegistry.invoke(invocation.name, invocation, ctx);
        if (result.ok) {
          capabilityResults.push({
            name: invocation.name,
            status: 'success',
            detail: 'Fixture payload returned',
            data: result.data
          });
        } else if (result.refusal) {
          const alias = result.refusal.alias;
          const code = resolveRefusalCode(alias, deps.refusalAliases);
          capabilityResults.push({
            name: invocation.name,
            status: 'refusal',
            detail: result.refusal.reason,
            refusalAlias: alias,
            refusalCode: code
          });
        }
      }

      ctx.audit.capabilityResults = capabilityResults;

      const anyRefusals = capabilityResults.find((entry) => entry.status === 'refusal');
      if (anyRefusals) {
        const refusal = anyRefusals;
        const code = refusal.refusalCode ?? resolveRefusalCode(refusal.refusalAlias ?? '', deps.refusalAliases);
        ctx.audit.termination = {
          kind: 'REFUSAL',
          code,
          reason: refusal.detail
        };
        reply.status(502);
        return {
          status: 'refusal' as const,
          code,
          alias: refusal.refusalAlias,
          reason: refusal.detail,
          audit: summarizeAudit(ctx.audit)
        };
      }

      const summary = `Ingress ${ctx.execId} executed ${capabilityResults.length} capability calls.`;
      const response = finalizeWithSuccess(ctx, summary);
      return {
        ...response,
        capabilities: capabilityResults
      };
    });
  });
}

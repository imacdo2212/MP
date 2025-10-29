import { createHash } from 'node:crypto';

import Fastify from 'fastify';
import { newDb } from 'pg-mem';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildCapabilityRegistry } from '../capabilities/registry.js';
import { recordAudit as persistAudit } from '../audit/index.js';
import { createInsertOnlyDatabaseClient } from '../db/client.js';
import { loadManifestConfig } from '../config/manifest.js';
import type { AuditRecord, AuditWriter } from '../services/audit.js';
import { registerIngressRoute } from '../server/routes/ingress.js';

interface TestContext {
  app: ReturnType<typeof Fastify>;
  manifestConfig: Awaited<ReturnType<typeof loadManifestConfig>>;
  refusalAliases: Awaited<ReturnType<typeof loadManifestConfig>>['manifest']['config']['refusal_aliases'];
}

function computeChainHash(
  execId: string,
  prevExecHash: string | null,
  route: string,
  status: string,
  reason?: string | null
): string {
  const hash = createHash('sha256');
  hash.update(execId);
  hash.update('|');
  hash.update(prevExecHash ?? '');
  hash.update('|');
  hash.update(route);
  hash.update('|');
  hash.update(status);
  if (reason) {
    hash.update('|');
    hash.update(reason);
  }
  return hash.digest('hex');
}

function normalizeBudgets(budgets: AuditRecord['budgets']) {
  return JSON.parse(JSON.stringify(budgets)) as Record<string, unknown>;
}

function normalizeTermination(termination: AuditRecord['termination']) {
  if (!termination) {
    return { status: 'unknown', reason: 'missing termination' as const };
  }

  if (termination.kind === 'BOUNDED_OUTPUT') {
    return { status: 'success', reason: termination.summary };
  }

  return { status: 'refusal', reason: termination.reason ?? termination.code };
}

describe('Ingress route to audit ledger integration', () => {
  const ctx: Partial<TestContext> = {};
  let dbPool: { pool: any; close: () => Promise<void> } | null = null;
  let auditWriter: AuditWriter | null = null;

  beforeEach(async () => {
    const manifestConfig = await loadManifestConfig();
    const refusalAliases = manifestConfig.manifest.config.refusal_aliases;
    const capabilityRegistry = buildCapabilityRegistry(refusalAliases);
    const db = newDb();

    db.public.none(`
      CREATE TABLE audit_ledger (
        exec_id TEXT PRIMARY KEY,
        prev_exec_hash TEXT,
        chain_hash TEXT NOT NULL,
        route TEXT NOT NULL,
        budgets_granted JSONB NOT NULL,
        budgets_used JSONB NOT NULL,
        termination_status TEXT NOT NULL,
        termination_reason TEXT,
        terminated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    const adapter = db.adapters.createPg();
    const pool = new adapter.Pool();
    const insertClient = createInsertOnlyDatabaseClient(pool);
    const records: AuditRecord[] = [];
    let lastChainHash: string | null = null;

    auditWriter = {
      async write(record: AuditRecord) {
        records.push(record);
        const termination = normalizeTermination(record.termination);
        const frame = {
          execId: record.execId,
          prevExecHash: lastChainHash,
          route: record.route,
          budgets: {
            granted: normalizeBudgets(record.budgets),
            used: {}
          },
          termination: {
            status: termination.status,
            reason: termination.reason
          }
        } as const;

        await persistAudit(frame, { client: insertClient });
        lastChainHash = computeChainHash(
          frame.execId,
          frame.prevExecHash ?? null,
          frame.route,
          frame.termination.status,
          frame.termination.reason ?? null
        );
      },
      getRecords() {
        return [...records];
      }
    };

    const app = Fastify({ logger: false });
    registerIngressRoute(app, {
      manifestConfig,
      refusalAliases,
      capabilityRegistry,
      auditWriter
    });

    ctx.app = app;
    ctx.manifestConfig = manifestConfig;
    ctx.refusalAliases = refusalAliases;
    dbPool = {
      pool,
      async close() {
        await pool.end();
      }
    };
  });

  afterEach(async () => {
    if (ctx.app) {
      await ctx.app.close();
      ctx.app = undefined;
    }
    if (dbPool) {
      await dbPool.close();
      dbPool = null;
    }
    auditWriter = null;
  });

  it('persists ingress audits and maintains a hash chain', async () => {
    if (!ctx.app || !dbPool) {
      throw new Error('test context not initialized');
    }

    const first = await ctx.app.inject({
      method: 'POST',
      url: '/ingress',
      payload: {
        intent: 'Legal contract review',
        payload: { nonce: 'first-hop' },
        capabilities: [{ name: 'legalSearch' }]
      }
    });

    expect(first.statusCode).toBe(200);

    const second = await ctx.app.inject({
      method: 'POST',
      url: '/ingress',
      payload: {
        intent: 'Legal contract review',
        payload: { nonce: 'second-hop' },
        capabilities: [{ name: 'complianceScanner', scenario: 'failure' }]
      }
    });

    expect(second.statusCode).toBe(502);

    const result = await dbPool.pool.query(
      `SELECT exec_id, prev_exec_hash, chain_hash, route, termination_status, termination_reason
       FROM audit_ledger
       ORDER BY created_at ASC`
    );

    expect(result.rows).toHaveLength(2);

    const [firstRow, secondRow] = result.rows as Array<{
      exec_id: string;
      prev_exec_hash: string | null;
      chain_hash: string;
      route: string;
      termination_status: string;
      termination_reason: string | null;
    }>;

    expect(firstRow.prev_exec_hash).toBeNull();
    expect(secondRow.prev_exec_hash).toBe(firstRow.chain_hash);

    const expectedFirstHash = computeChainHash(
      firstRow.exec_id,
      firstRow.prev_exec_hash,
      firstRow.route,
      firstRow.termination_status,
      firstRow.termination_reason
    );
    const expectedSecondHash = computeChainHash(
      secondRow.exec_id,
      secondRow.prev_exec_hash,
      secondRow.route,
      secondRow.termination_status,
      secondRow.termination_reason
    );

    expect(firstRow.chain_hash).toBe(expectedFirstHash);
    expect(secondRow.chain_hash).toBe(expectedSecondHash);
  });

  it('surfaces a deterministic refusal when the audit ledger is unavailable', async () => {
    const manifestConfig = await loadManifestConfig();
    const refusalAliases = manifestConfig.manifest.config.refusal_aliases;
    const capabilityRegistry = buildCapabilityRegistry(refusalAliases);

    const failingWriter: AuditWriter = {
      async write() {
        throw new Error('ledger offline');
      },
      getRecords() {
        return [];
      }
    };

    const app = Fastify({ logger: false });
    registerIngressRoute(app, {
      manifestConfig,
      refusalAliases,
      capabilityRegistry,
      auditWriter: failingWriter
    });

    const response = await app.inject({
      method: 'POST',
      url: '/ingress',
      payload: {
        intent: 'Legal contract review',
        capabilities: [{ name: 'legalSearch' }]
      }
    });

    expect(response.statusCode).toBe(503);
    const body = response.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      status: 'refusal',
      code: refusalAliases.TOOL_FAIL,
      alias: 'TOOL_FAIL',
      reason: 'Audit ledger unavailable'
    });

    const audit = body.audit as { termination: { kind: string; code: string; reason: string } };
    expect(audit.termination).toEqual({
      kind: 'REFUSAL',
      code: refusalAliases.TOOL_FAIL,
      reason: 'Audit ledger unavailable'
    });

    await app.close();
  });
});

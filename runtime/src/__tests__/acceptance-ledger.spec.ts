import 'reflect-metadata';

import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { newDb } from 'pg-mem';

interface LedgerRowPayload {
  exec_id: string;
  intent: string;
  route: string;
  hop_count: number;
  budgets_granted: Record<string, unknown>;
  budgets_consumed: Record<string, unknown>;
  termination_code: string;
  metadata: Record<string, unknown>;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
}

function computeHash(prevHash: string, payload: LedgerRowPayload): string {
  const normalized = sortValue(payload);
  const serialized = JSON.stringify(normalized);
  return crypto.createHash('sha256').update(prevHash).update(serialized).digest('hex');
}

describe('Apex manifest acceptance tests — audit ledger', () => {
  it('Apex-T5: audit chain remains intact under min clamp policy', async () => {
    const originalDbUrl = process.env.DATABASE_URL;

    let closePoolFn: (() => Promise<void>) | undefined;

    try {
      vi.resetModules();
      const db = newDb({ autoCreateForeignKeyIndices: true });
      const pgMem = db.adapters.createPg();
      const pool = new pgMem.Pool();

      vi.doMock('../db/client.js', () => ({
        getPool: () => pool,
        withConnection: async <T>(fn: (client: PoolClient) => Promise<T>) => {
          const client = await pool.connect();
          try {
            return await fn(client);
          } finally {
            client.release();
          }
        },
        closePool: async () => {
          await pool.end();
        }
      }));

      const { recordAudit } = await import('../db/ledger.js');
      const { withConnection, closePool } = await import('../db/client.js');
      closePoolFn = closePool;

      await withConnection(async (client) => {
        await client.query(`
          CREATE TABLE IF NOT EXISTS audit_ledger (
            id BIGSERIAL PRIMARY KEY,
            exec_id TEXT NOT NULL UNIQUE,
            intent TEXT NOT NULL,
            route TEXT NOT NULL,
            hop_count INTEGER NOT NULL,
            budgets_granted JSONB NOT NULL,
            budgets_consumed JSONB NOT NULL,
            termination_code TEXT NOT NULL,
            prev_hash TEXT NOT NULL,
            record_hash TEXT NOT NULL UNIQUE,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await client.query(
          'CREATE INDEX IF NOT EXISTS audit_ledger_route_idx ON audit_ledger(route)'
        );
        await client.query(
          'CREATE INDEX IF NOT EXISTS audit_ledger_created_at_idx ON audit_ledger(created_at)'
        );
      });

      const baseBudgets = {
        tokens_prompt_max: 4_000,
        tokens_output_max: 1_200,
        time_ms: 60_000,
        mem_mb: 512,
        depth_max: 6,
        clarifying_questions_max: 3,
        tools_max: 4,
        tool_calls_max: 12,
        web_requests_max: 8,
        code_exec_ms_max: 15_000,
        citations_required: false,
        cot_visibility: 'hidden'
      } as const;

      const narrowedBudgets = { ...baseBudgets, tokens_output_max: 1_000 };

      const firstHash = await recordAudit({
        execId: 'exec_acceptance_1',
        intent: 'Legal contract review',
        route: 'mpa.rumpole',
        hopCount: 1,
        budgetsGranted: narrowedBudgets,
        budgetsConsumed: { tokens_output_max: 950, time_ms: 30_000 },
        terminationCode: 'OK_ACCEPTANCE',
        metadata: { requestId: 'req-1' }
      });

      const secondHash = await recordAudit({
        execId: 'exec_acceptance_2',
        intent: 'Legal contract review',
        route: 'mpa.rumpole',
        hopCount: 1,
        budgetsGranted: narrowedBudgets,
        budgetsConsumed: { tokens_output_max: 1_000, time_ms: 30_000 },
        terminationCode: 'OK_ACCEPTANCE',
        metadata: { requestId: 'req-2' }
      });

      expect(firstHash).not.toBe(secondHash);

      const rows = await withConnection(async (client) => {
        const result = await client.query<{
          exec_id: string;
          prev_hash: string;
          record_hash: string;
          intent: string;
          route: string;
          hop_count: number;
          budgets_granted: Record<string, unknown>;
          budgets_consumed: Record<string, unknown>;
          termination_code: string;
          metadata: Record<string, unknown>;
        }>('SELECT * FROM audit_ledger ORDER BY id ASC');
        return result.rows;
      });

      expect(rows).toHaveLength(2);
      const [firstRow, secondRow] = rows;

      expect(firstRow.prev_hash).toBe('GENESIS');
      expect(secondRow.prev_hash).toBe(firstRow.record_hash);

      const firstPayload: LedgerRowPayload = {
        exec_id: firstRow.exec_id,
        intent: firstRow.intent,
        route: firstRow.route,
        hop_count: firstRow.hop_count,
        budgets_granted: firstRow.budgets_granted,
        budgets_consumed: firstRow.budgets_consumed,
        termination_code: firstRow.termination_code,
        metadata: firstRow.metadata
      };

      const secondPayload: LedgerRowPayload = {
        exec_id: secondRow.exec_id,
        intent: secondRow.intent,
        route: secondRow.route,
        hop_count: secondRow.hop_count,
        budgets_granted: secondRow.budgets_granted,
        budgets_consumed: secondRow.budgets_consumed,
        termination_code: secondRow.termination_code,
        metadata: secondRow.metadata
      };

      expect(firstRow.record_hash).toBe(computeHash('GENESIS', firstPayload));
      expect(secondRow.record_hash).toBe(
        computeHash(secondRow.prev_hash, secondPayload)
      );

    } finally {
      if (closePoolFn) {
        await closePoolFn();
      }
      vi.unmock('../db/client.js');
      vi.resetModules();
      if (originalDbUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = originalDbUrl;
      }
    }
  });
});

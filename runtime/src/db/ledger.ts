import crypto from 'crypto';
import type { PoolClient } from 'pg';

import type { BudgetDefaults } from '../config/manifest.js';
import { withConnection } from './client.js';

export type BudgetSnapshot = BudgetDefaults;
export type BudgetConsumption = Partial<BudgetDefaults>;

export interface AuditRecord {
  execId: string;
  intent: string;
  route: string;
  hopCount: number;
  budgetsGranted: BudgetSnapshot;
  budgetsConsumed: BudgetConsumption;
  terminationCode: string;
  metadata?: Record<string, unknown>;
}

interface LedgerRowInput {
  exec_id: string;
  intent: string;
  route: string;
  hop_count: number;
  budgets_granted: BudgetSnapshot;
  budgets_consumed: BudgetConsumption;
  termination_code: string;
  metadata: Record<string, unknown>;
}

const GENESIS_HASH = 'GENESIS';

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

function createDeterministicHash(prevHash: string, payload: LedgerRowInput): string {
  const normalizedPayload = sortValue(payload);
  const payloadString = JSON.stringify(normalizedPayload);
  return crypto.createHash('sha256').update(prevHash).update(payloadString).digest('hex');
}

async function getLatestHash(client: PoolClient): Promise<string> {
  const result = await client.query<{ record_hash: string }>(
    'SELECT record_hash FROM audit_ledger ORDER BY id DESC LIMIT 1'
  );

  if (result.rows.length === 0) {
    return GENESIS_HASH;
  }

  return result.rows[0].record_hash;
}

async function insertLedgerRow(client: PoolClient, row: LedgerRowInput): Promise<string> {
  const prevHash = await getLatestHash(client);
  const recordHash = createDeterministicHash(prevHash, row);

  await client.query(
    `INSERT INTO audit_ledger (
      exec_id,
      intent,
      route,
      hop_count,
      budgets_granted,
      budgets_consumed,
      termination_code,
      prev_hash,
      record_hash,
      metadata
    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10::jsonb)`,
    [
      row.exec_id,
      row.intent,
      row.route,
      row.hop_count,
      JSON.stringify(row.budgets_granted),
      JSON.stringify(row.budgets_consumed),
      row.termination_code,
      prevHash,
      recordHash,
      JSON.stringify(row.metadata)
    ]
  );

  return recordHash;
}

export async function recordAudit(record: AuditRecord): Promise<string> {
  const payload: LedgerRowInput = {
    exec_id: record.execId,
    intent: record.intent,
    route: record.route,
    hop_count: record.hopCount,
    budgets_granted: record.budgetsGranted,
    budgets_consumed: record.budgetsConsumed,
    termination_code: record.terminationCode,
    metadata: record.metadata ?? {}
  };

  return withConnection(async (client) => {
    await client.query('BEGIN');
    try {
      const hash = await insertLedgerRow(client, payload);
      await client.query('COMMIT');
      return hash;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

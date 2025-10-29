import { closePool, withConnection } from './client.js';

const MIGRATIONS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS audit_ledger (
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
    )`,
  `CREATE INDEX IF NOT EXISTS audit_ledger_route_idx ON audit_ledger(route)`,
  `CREATE INDEX IF NOT EXISTS audit_ledger_created_at_idx ON audit_ledger(created_at)`
];

async function runMigrations(): Promise<void> {
  await withConnection(async (client) => {
    await client.query('BEGIN');
    try {
      for (const statement of MIGRATIONS) {
        await client.query(statement);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

runMigrations()
  .then(() => {
    console.log('Database migrations completed successfully.');
  })
  .catch((error) => {
    console.error('Database migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

import type { Pool, PoolClient, PoolConfig } from 'pg';
import { Pool as PgPool } from 'pg';

let pool: Pool | null = null;

function buildPool(config?: PoolConfig): Pool {
  const connectionString = process.env.DATABASE_URL ?? 'postgresql://localhost:5432/mp_runtime';
  return new PgPool({
    connectionString,
    max: 5,
    allowExitOnIdle: true,
    ...config
  });
}

export function getPool(config?: PoolConfig): Pool {
  if (!pool) {
    pool = buildPool(config);
  }

  return pool;
}

export async function withConnection<T>(
  fn: (client: PoolClient) => Promise<T>,
  config?: PoolConfig
): Promise<T> {
  const currentPool = getPool(config);
  const client = await currentPool.connect();

  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
}

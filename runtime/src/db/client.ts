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
export interface QueryResult<T = unknown> {
  rows: T[];
}

export interface Queryable {
  query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
}

const MUTATING_COMMANDS = new Set(['UPDATE', 'DELETE', 'TRUNCATE', 'DROP', 'ALTER']);

function assertInsertOnly(sql: string): void {
  const normalized = sql.trim().toUpperCase();
  if (!normalized) {
    throw new Error('Empty SQL statements are not allowed.');
  }

  const command = normalized.split(/\s+/)[0];
  if (command === 'INSERT' || command === 'WITH') {
    // WITH queries may wrap INSERT statements. Validation for the actual command
    // happens when the caller constructs the SQL string.
    return;
  }

  if (command === 'SELECT') {
    return;
  }

  if (MUTATING_COMMANDS.has(command)) {
    throw new Error(`Mutating SQL command "${command}" is not permitted on the insert-only client.`);
  }

  throw new Error(`SQL command "${command}" is not supported by the insert-only client.`);
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export class InsertOnlyDatabaseClient {
  constructor(private readonly client: Queryable) {}

  async query<T = unknown>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>> {
    assertInsertOnly(sql);
    return this.client.query<T>(sql, params);
  }

  async insert<T = unknown>(
    table: string,
    record: Record<string, unknown>,
    returning?: readonly string[]
  ): Promise<QueryResult<T>> {
    const columns = Object.keys(record);
    if (columns.length === 0) {
      throw new Error('Cannot construct INSERT statement without any columns.');
    }

    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const sql = [
      `INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')})`,
      `VALUES (${placeholders.join(', ')})`
    ];

    if (returning && returning.length > 0) {
      sql.push(`RETURNING ${returning.map(quoteIdentifier).join(', ')}`);
    }

    return this.query<T>(sql.join(' ') + ';', columns.map((column) => record[column]));
  }
}

export function createInsertOnlyDatabaseClient(client: Queryable): InsertOnlyDatabaseClient {
  return new InsertOnlyDatabaseClient(client);
}

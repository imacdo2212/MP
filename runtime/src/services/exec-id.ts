import { createHash } from 'node:crypto';

export interface ExecIdSeed {
  route: string;
  hopCount: number;
  budgets: unknown;
  payload?: unknown;
  timestamp: string;
}

export function createExecId(seed: ExecIdSeed): string {
  const hash = createHash('sha256');
  const { timestamp, ...rest } = seed;
  hash.update(JSON.stringify(rest));
  const digest = hash.digest('hex').slice(0, 32);
  return `${timestamp}:${digest}`;
}

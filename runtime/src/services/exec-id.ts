import { createHash } from 'node:crypto';

export interface ExecIdSeed {
  route: string;
  hopCount: number;
  budgets: unknown;
  payload?: unknown;
}

export function createExecId(seed: ExecIdSeed): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify(seed));
  return hash.digest('hex').slice(0, 32);
}

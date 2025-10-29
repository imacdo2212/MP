import { createHash, randomUUID } from 'crypto';
import type { InsertOnlyDatabaseClient } from '../db/client.js';

export interface AuditBudgets {
  granted: Record<string, unknown>;
  used: Record<string, unknown>;
}

export interface TerminationDetails {
  status: 'success' | 'failure' | string;
  reason?: string;
  at?: Date;
}

export interface AuditFrame {
  execId?: string;
  prevExecHash?: string | null;
  route: string;
  budgets: AuditBudgets;
  termination: TerminationDetails;
  createdAt?: Date;
  chainHash?: string;
}

export interface AuditRecorderOptions {
  client?: InsertOnlyDatabaseClient | null;
}

function computeChainHash(frame: Required<Pick<AuditFrame, 'execId' | 'prevExecHash' | 'route'>> & {
  termination: TerminationDetails;
}): string {
  const hash = createHash('sha256');
  hash.update(frame.execId);
  hash.update('|');
  hash.update(frame.prevExecHash ?? '');
  hash.update('|');
  hash.update(frame.route);
  hash.update('|');
  hash.update(frame.termination.status);
  if (frame.termination.reason) {
    hash.update('|');
    hash.update(frame.termination.reason);
  }
  return hash.digest('hex');
}

export async function recordAudit(frame: AuditFrame, options: AuditRecorderOptions = {}): Promise<void> {
  const execId = frame.execId ?? randomUUID();
  const createdAt = frame.createdAt ?? new Date();
  const prevExecHash = frame.prevExecHash ?? null;
  const chainHash =
    frame.chainHash ??
    computeChainHash({
      execId,
      prevExecHash,
      route: frame.route,
      termination: frame.termination
    });

  if (!options.client) {
    console.info('[audit] insert-only client not configured; audit frame logged instead', {
      execId,
      prevExecHash,
      chainHash,
      route: frame.route,
      budgets: frame.budgets,
      termination: frame.termination,
      createdAt
    });
    return;
  }

  await options.client.insert('audit_ledger', {
    exec_id: execId,
    prev_exec_hash: prevExecHash,
    chain_hash: chainHash,
    route: frame.route,
    budgets_granted: JSON.stringify(frame.budgets.granted),
    budgets_used: JSON.stringify(frame.budgets.used),
    termination_status: frame.termination.status,
    termination_reason: frame.termination.reason ?? null,
    terminated_at: frame.termination.at ?? null,
    created_at: createdAt
  });
}

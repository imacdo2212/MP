import type { EffectiveBudgets } from '../config/manifest.js';

export interface HopBounds {
  maxHops: number;
  codeAlias: string;
}

export interface CapabilityAuditEntry {
  name: string;
  status: 'success' | 'refusal';
  detail: string;
  data?: unknown;
  refusalCode?: string;
  refusalAlias?: string;
}

export type TerminationState =
  | { kind: 'BOUNDED_OUTPUT'; summary: string }
  | { kind: 'REFUSAL'; code: string; reason: string; diagnostics?: Record<string, unknown> };

export interface AuditRecord {
  execId: string;
  route: string;
  hopCount: number;
  hopBounds: HopBounds;
  budgets: EffectiveBudgets;
  requestedAt: string;
  capabilityResults: CapabilityAuditEntry[];
  termination?: TerminationState;
}

export interface AuditWriter {
  write(record: AuditRecord): Promise<void>;
  getRecords(): AuditRecord[];
}

interface Logger {
  info: (message: unknown, ...args: unknown[]) => void;
  error: (message: unknown, ...args: unknown[]) => void;
}

function toSerializable(record: AuditRecord) {
  return {
    ...record,
    capabilityResults: record.capabilityResults.map((entry) => ({
      ...entry,
      data: entry.data ?? null
    }))
  };
}

export function createAuditWriter(logger: Logger = console): AuditWriter {
  const records: AuditRecord[] = [];

  return {
    async write(record: AuditRecord): Promise<void> {
      records.push({ ...record, capabilityResults: [...record.capabilityResults] });
      logger.info({ audit: toSerializable(record) }, 'audit.write');
    },
    getRecords(): AuditRecord[] {
      return [...records];
    }
  };
}

export function summarizeAudit(record: AuditRecord) {
  return {
    execId: record.execId,
    route: record.route,
    hopCount: record.hopCount,
    hopBounds: record.hopBounds,
    budgets: record.budgets,
    termination: record.termination
  };
}

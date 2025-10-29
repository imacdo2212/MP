import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import type { AuditRecord } from './ledger.js';
import { closePool } from './client.js';
import { recordAudit } from './ledger.js';

@Injectable()
export class AuditLedgerService implements OnModuleDestroy {
  private readonly logger = new Logger(AuditLedgerService.name);

  async record(record: AuditRecord): Promise<string> {
    return recordAudit(record);
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await closePool();
    } catch (error) {
      this.logger.warn(`Failed to close database pool cleanly: ${String(error)}`);
    }
  }
}

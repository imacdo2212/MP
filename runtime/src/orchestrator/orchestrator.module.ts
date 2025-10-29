import { Module } from '@nestjs/common';

import { CapabilityModule } from '../capabilities/capability.module.js';
import { ManifestConfigModule } from '../config/module.js';
import { AuditLedgerService } from '../db/audit-ledger.service.js';
import { OrchestratorController } from '../ingress/orchestrator.controller.js';
import { OrchestratorService } from './orchestrator.service.js';

@Module({
  imports: [ManifestConfigModule, CapabilityModule],
  controllers: [OrchestratorController],
  providers: [OrchestratorService, AuditLedgerService],
  exports: [OrchestratorService]
})
export class OrchestratorModule {}

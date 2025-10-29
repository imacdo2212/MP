import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';

import type { BudgetOverrides } from '../config/manifest.js';
import { OrchestratorService } from '../orchestrator/orchestrator.service.js';

interface OrchestrateRequestBody {
  intent: string;
  payload?: unknown;
  callerBudgets?: BudgetOverrides;
  hopsTaken?: number;
  requestId?: string;
}

@Controller('orchestrator')
export class OrchestratorController {
  constructor(@Inject(OrchestratorService) private readonly orchestrator: OrchestratorService) {}

  @Post()
  @HttpCode(200)
  orchestrate(@Body() body: OrchestrateRequestBody) {
    return this.orchestrator.execute({
      intent: body.intent,
      payload: body.payload ?? {},
      callerBudgets: body.callerBudgets,
      hopsTaken: body.hopsTaken,
      requestId: body.requestId
    });
  }
}

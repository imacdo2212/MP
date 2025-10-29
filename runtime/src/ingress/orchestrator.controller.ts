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
import { BadRequestException, Body, Controller, InternalServerErrorException, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MANIFEST_CONFIG_KEY } from '../config/manifest.js';
import type { ManifestConfig } from '../config/manifest.js';

interface OrchestratorRequest {
  intent: string;
  payload?: unknown;
}

interface OrchestratorResponse {
  intent: string;
  route: string;
  budgets: ReturnType<ManifestConfig['resolveBudgets']>;
  payload?: unknown;
}

@Controller('ingress')
export class OrchestratorController {
  constructor(private readonly configService: ConfigService) {}

  @Post()
  orchestrate(@Body() body: OrchestratorRequest): OrchestratorResponse {
    const manifestConfig = this.configService.get<ManifestConfig>(MANIFEST_CONFIG_KEY);
    if (!manifestConfig) {
      throw new InternalServerErrorException('Manifest configuration is not available.');
    }

    const intent = body.intent?.trim();
    if (!intent) {
      throw new BadRequestException('Intent must be provided.');
    }

    const route = manifestConfig.getIntentRoute(intent);
    const budgets = manifestConfig.resolveBudgets(route);

    return {
      intent,
      route,
      budgets,
      payload: body.payload
    };
  }
}

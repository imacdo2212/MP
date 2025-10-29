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

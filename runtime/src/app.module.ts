import { Module } from '@nestjs/common';

import { OrchestratorModule } from './orchestrator/orchestrator.module.js';

@Module({
  imports: [OrchestratorModule]
import { ConfigModule } from '@nestjs/config';

import { loadManifestConfig, MANIFEST_CONFIG_KEY } from './config/manifest.js';
import { OrchestratorController } from './ingress/orchestrator.controller.js';

@Module({
  imports: [
    ConfigModule.forRootAsync({
      isGlobal: true,
      useFactory: async () => {
        const manifestConfig = await loadManifestConfig();
        return { [MANIFEST_CONFIG_KEY]: manifestConfig };
      }
    })
  ],
  controllers: [OrchestratorController]
})
export class AppModule {}

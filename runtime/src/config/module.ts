import { Injectable, Module, OnModuleInit } from '@nestjs/common';

import type { ManifestConfig } from './manifest.js';
import { loadManifestConfig } from './manifest.js';

@Injectable()
export class ManifestConfigService implements OnModuleInit {
  private config: ManifestConfig | null = null;
  private loadPromise: Promise<ManifestConfig> | null = null;

  async onModuleInit(): Promise<void> {
    await this.ensureConfig();
  }

  private async ensureConfig(): Promise<ManifestConfig> {
    if (!this.loadPromise) {
      this.loadPromise = loadManifestConfig().then((config) => {
        this.config = config;
        return config;
      });
    }

    return this.loadPromise;
  }

  private assertConfig(): ManifestConfig {
    if (!this.config) {
      throw new Error('Manifest configuration requested before initialization.');
    }

    return this.config;
  }

  async getManifest(): Promise<ManifestConfig['manifest']> {
    const config = await this.ensureConfig();
    return config.manifest;
  }

  async resolveBudgets(route: string) {
    const config = await this.ensureConfig();
    return config.resolveBudgets(route);
  }

  async getIntentRoute(intent: string) {
    const config = await this.ensureConfig();
    return config.getIntentRoute(intent);
  }

  get manifest(): ManifestConfig['manifest'] {
    return this.assertConfig().manifest;
  }
}

@Module({
  providers: [ManifestConfigService],
  exports: [ManifestConfigService]
})
export class ManifestConfigModule {}

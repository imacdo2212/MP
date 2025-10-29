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
import { createManifestConfig, loadManifest, Manifest, ManifestConfig } from './manifest.js';

export interface ConfigModuleOptions {
  manifestPath?: string;
  manifest?: Manifest;
}

export class ConfigModule {
  private static config: ManifestConfig | null = null;

  static async bootstrap(options: ConfigModuleOptions = {}): Promise<ManifestConfig> {
    if (!this.config) {
      if (options.manifest) {
        this.config = createManifestConfig(options.manifest);
      } else {
        const manifest = await loadManifest(options.manifestPath);
        this.config = createManifestConfig(manifest);
      }
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
  static get manifest(): Manifest {
    return this.ensureConfig().manifest;
  }

  static resolveBudgets(route: string) {
    return this.ensureConfig().resolveBudgets(route);
  }

  static getIntentRoute(intent: string) {
    return this.ensureConfig().getIntentRoute(intent);
  }

  static reset() {
    this.config = null;
  }

  private static ensureConfig(): ManifestConfig {
    if (!this.config) {
      throw new Error('ConfigModule has not been bootstrapped. Call ConfigModule.bootstrap() first.');
    }

    return this.config;
  }
}

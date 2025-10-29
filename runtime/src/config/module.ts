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

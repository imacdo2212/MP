import Fastify from 'fastify';
import { loadManifestConfig } from '../config/manifest.js';
import { buildCapabilityRegistry } from '../capabilities/registry.js';
import { createAuditWriter } from '../services/audit.js';
import type { RefusalAliases } from '../shared/refusals.js';
import { registerIngressRoute } from './routes/ingress.js';

export interface AppOptions {
  manifestPath?: string;
  logger?: boolean;
}

export async function createApp(options: AppOptions = {}) {
  const manifestConfig = await loadManifestConfig(options.manifestPath);
  const refusalAliases: RefusalAliases = manifestConfig.manifest.config.refusal_aliases;
  const app = Fastify({
    logger: options.logger ?? true
  });

  const capabilityRegistry = buildCapabilityRegistry(refusalAliases);
  const auditWriter = createAuditWriter(app.log);

  registerIngressRoute(app, {
    manifestConfig,
    refusalAliases,
    capabilityRegistry,
    auditWriter
  });

  return app;
}

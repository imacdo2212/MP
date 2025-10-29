import { loadManifestConfig } from './config/manifest.js';
import { closePool } from './db/client.js';
import { recordAudit } from './db/ledger.js';

async function main() {
  const config = await loadManifestConfig();

  const rumpoleBudgets = config.resolveBudgets('mpa.rumpole');
  const toolBudgets = config.resolveBudgets('mpt.query');
  const legalRoute = config.getIntentRoute('legal contract review');
  const defaultRoute = config.getIntentRoute('unknown request');
import { createApp } from './server/app.js';

async function main() {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3000);
  const host = '0.0.0.0';

  await app.listen({ port, host });
  app.log.info(`Ingress service listening on http://${host}:${port}`);
}

main().catch((error) => {
  console.error('Failed to start ingress service:', error);
import { randomUUID } from 'crypto';
import { loadManifestConfig } from './config/manifest.js';
import { recordAudit } from './audit/index.js';

async function main() {
  const execId = randomUUID();
  const config = await loadManifestConfig();
import { ConfigModule } from './config/module.js';

async function main() {
  await ConfigModule.bootstrap();

  const rumpoleBudgets = ConfigModule.resolveBudgets('mpa.rumpole');
  const toolBudgets = ConfigModule.resolveBudgets('mpt.query');
  const legalRoute = ConfigModule.getIntentRoute('legal contract review');
  const defaultRoute = ConfigModule.getIntentRoute('unknown request');

  const budgetsGranted: Record<string, unknown> = {
    ...config.manifest.config.budgets_defaults
  };

  const budgetsUsed: Record<string, unknown> = {
    'mpa.rumpole': { ...rumpoleBudgets },
    'mpt.query': { ...toolBudgets }
  };

  console.log('Resolved budgets for mpa.rumpole:', rumpoleBudgets);
  console.log('Resolved budgets for mpt.query:', toolBudgets);
  console.log('Intent "legal contract review" routes to:', legalRoute);
  console.log('Intent "unknown request" routes to:', defaultRoute);

  try {
    const hash = await recordAudit({
      execId: `demo-${Date.now()}`,
      intent: 'legal contract review',
      route: legalRoute,
      hopCount: 1,
      budgetsGranted: rumpoleBudgets,
      budgetsConsumed: {
        tokens_prompt_max: Math.min(rumpoleBudgets.tokens_prompt_max, 250),
        tokens_output_max: Math.min(rumpoleBudgets.tokens_output_max, 128),
        time_ms: Math.min(rumpoleBudgets.time_ms, 250),
        mem_mb: Math.min(rumpoleBudgets.mem_mb, 64)
      },
      terminationCode: 'OK_DEMO',
      metadata: {
        demo: true,
        note: 'Placeholder audit frame until orchestrator wiring is complete.'
      }
    });

    console.log('Recorded demo audit hash:', hash);
  } catch (error) {
    console.warn('Audit ledger not available; skipping demo insert:', error);
  }
}

main().catch((error) => {
  console.error('Failed to load manifest config:', error);
  process.exitCode = 1;
}).finally(async () => {
  await closePool();
  await recordAudit({
    execId,
    route: legalRoute,
    budgets: {
      granted: budgetsGranted,
      used: budgetsUsed
    },
    termination: {
      status: 'success',
      reason: 'Runtime initialization completed successfully.',
      at: new Date()
    }
  });
}

main().catch(async (error) => {
  console.error('Failed to load manifest config:', error);
  await recordAudit({
    route: 'runtime.startup',
    budgets: {
      granted: {},
      used: {}
    },
    termination: {
      status: 'failure',
      reason: error instanceof Error ? error.message : 'Unknown startup failure.',
      at: new Date()
    }
  });
  process.exitCode = 1;
});

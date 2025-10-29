import { loadManifestConfig } from './config/manifest.js';
import { closePool } from './db/client.js';
import { recordAudit } from './db/ledger.js';

async function main() {
  const config = await loadManifestConfig();

  const rumpoleBudgets = config.resolveBudgets('mpa.rumpole');
  const toolBudgets = config.resolveBudgets('mpt.query');
  const legalRoute = config.getIntentRoute('legal contract review');
  const defaultRoute = config.getIntentRoute('unknown request');

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
});

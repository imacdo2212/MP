import { loadManifestConfig } from './config/manifest.js';

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
}

main().catch((error) => {
  console.error('Failed to load manifest config:', error);
  process.exitCode = 1;
});

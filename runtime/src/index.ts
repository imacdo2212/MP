import { ConfigModule } from './config/module.js';

async function main() {
  await ConfigModule.bootstrap();

  const rumpoleBudgets = ConfigModule.resolveBudgets('mpa.rumpole');
  const toolBudgets = ConfigModule.resolveBudgets('mpt.query');
  const legalRoute = ConfigModule.getIntentRoute('legal contract review');
  const defaultRoute = ConfigModule.getIntentRoute('unknown request');

  console.log('Resolved budgets for mpa.rumpole:', rumpoleBudgets);
  console.log('Resolved budgets for mpt.query:', toolBudgets);
  console.log('Intent "legal contract review" routes to:', legalRoute);
  console.log('Intent "unknown request" routes to:', defaultRoute);
}

main().catch((error) => {
  console.error('Failed to load manifest config:', error);
  process.exitCode = 1;
});

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { AuditLedger, createRuntime } from '../runtime.js';

test('caller-imposed budgets never exceed clamp policy during routed execution', async () => {
  const ledger = new AuditLedger();
  const runtime = await createRuntime(undefined, ledger);

  const result = runtime.simulateRoutedRequest({
    execId: 'exec-clamp-001',
    intent: 'Legal contract review',
    callerBudgets: {
      tokens_output_max: 3200,
      time_ms: 120000,
      mem_mb: 1024
    },
    hopsUsed: 2,
    consumption: {
      tokens_output_max: 1000,
      time_ms: 45000,
      mem_mb: 300
    }
  });

  assert.equal(result.kind, 'BOUNDED_OUTPUT');
  assert.equal(result.route, 'mpa.rumpole');
  assert.equal(result.budgets.tokens_output_max, 1200);
  assert.equal(result.budgets.time_ms, 60000);
  assert.equal(result.budgets.mem_mb, 512);

  const entry = result.ledgerEntry;
  assert.equal(entry.clampPolicy, 'min');
  assert.equal(entry.termination, 'BOUNDED_OUTPUT');
  assert.ok(ledger.verify());
});

test('hop bounds overflow triggers configured refusal code', async () => {
  const ledger = new AuditLedger();
  const runtime = await createRuntime(undefined, ledger);

  const result = runtime.simulateRoutedRequest({
    execId: 'exec-hop-007',
    intent: 'unknown request',
    hopsUsed: 7
  });

  assert.equal(result.kind, 'REFUSAL');
  assert.equal(result.code, 'REFUSAL(BOUND_DEPTH)');

  const [lastEntry] = ledger.getEntries().slice(-1);
  assert.equal(lastEntry?.termination, 'REFUSAL(BOUND_DEPTH)');
  assert.equal(lastEntry?.metrics.maxHops, 6);
  assert.equal(lastEntry?.metrics.reason, 'hop_bounds_exceeded');
  assert.ok(ledger.verify());
});

test('plane budget overflow emits bounded refusal alias', async () => {
  const ledger = new AuditLedger();
  const runtime = await createRuntime(undefined, ledger);

  const result = runtime.simulateRoutedRequest({
    execId: 'exec-plane-009',
    routeOverride: 'mpt.query',
    hopsUsed: 1,
    consumption: {
      tool_calls_max: 8
    }
  });

  assert.equal(result.kind, 'REFUSAL');
  assert.equal(result.code, 'REFUSAL(BOUND_*)');
  assert.deepEqual(result.overflowKeys, ['tool_calls_max']);

  const [lastEntry] = ledger.getEntries().slice(-1);
  assert.equal(lastEntry?.termination, 'REFUSAL(BOUND_*)');
  assert.equal(lastEntry?.metrics.reason, 'budget_overflow');
  assert.ok(ledger.verify());
});

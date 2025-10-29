import { describe, expect, it } from 'vitest';

import { AuditLedger, createRuntime } from '../runtime.js';

describe('RuntimeEngine budget policies', () => {
  it('applies caller clamp policy before routing execution', async () => {
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

    expect(result.kind).toBe('BOUNDED_OUTPUT');
    expect(result.route).toBe('mpa.rumpole');
    expect(result.budgets.tokens_output_max).toBe(1200);
    expect(result.budgets.time_ms).toBe(60000);
    expect(result.budgets.mem_mb).toBe(512);

    const entry = result.ledgerEntry;
    expect(entry.clampPolicy).toBe('min');
    expect(entry.termination).toBe('BOUNDED_OUTPUT');
    expect(ledger.verify()).toBe(true);
  });

  it('enforces hop bounds and records the refusal result', async () => {
    const ledger = new AuditLedger();
    const runtime = await createRuntime(undefined, ledger);

    const result = runtime.simulateRoutedRequest({
      execId: 'exec-hop-007',
      intent: 'unknown request',
      hopsUsed: 7
    });

    expect(result.kind).toBe('REFUSAL');
    expect(result.code).toBe('REFUSAL(BOUND_DEPTH)');

    const [lastEntry] = ledger.getEntries().slice(-1);
    expect(lastEntry?.termination).toBe('REFUSAL(BOUND_DEPTH)');
    expect(lastEntry?.metrics.maxHops).toBe(6);
    expect(lastEntry?.metrics.reason).toBe('hop_bounds_exceeded');
    expect(ledger.verify()).toBe(true);
  });

  it('normalizes budget overflow refusals with manifest aliases', async () => {
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

    expect(result.kind).toBe('REFUSAL');
    expect(result.code).toBe('REFUSAL(BOUND_*)');
    expect(result.overflowKeys).toEqual(['tool_calls_max']);

    const [lastEntry] = ledger.getEntries().slice(-1);
    expect(lastEntry?.termination).toBe('REFUSAL(BOUND_*)');
    expect(lastEntry?.metrics.reason).toBe('budget_overflow');
    expect(ledger.verify()).toBe(true);
  });
});

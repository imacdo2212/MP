import { describe, expect, it } from 'vitest';

import { resolveRefusalCode } from '../shared/refusals.js';

describe('resolveRefusalCode', () => {
  const aliases = {
    BOUND_BUDGET: 'BOUND_*',
    BOUND_DEPTH: 'BOUND_DEPTH',
    TOOL_FAIL: 'FRAGILITY',
    TOOL_TIMEOUT: 'BOUND_TIME'
  };

  it('returns manifest alias for bare keys', () => {
    expect(resolveRefusalCode('BOUND_BUDGET', aliases)).toBe('BOUND_*');
  });

  it('normalizes wrapped refusal tokens', () => {
    expect(resolveRefusalCode('REFUSAL(BOUND_DEPTH)', aliases)).toBe('BOUND_DEPTH');
  });

  it('falls back to trimmed token when alias missing', () => {
    expect(resolveRefusalCode('REFUSAL(UNKNOWN_CODE)', aliases)).toBe('UNKNOWN_CODE');
  });

  it('returns unknown code placeholder for empty aliases', () => {
    expect(resolveRefusalCode('', aliases)).toBe('UNKNOWN_REFUSAL');
  });
});

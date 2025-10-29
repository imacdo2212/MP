import { Inject, Injectable, Optional } from '@nestjs/common';
import { Injectable } from '@nestjs/common';

import type { BudgetConsumption, BudgetSnapshot } from '../db/ledger.js';

export interface CapabilityContext {
  intent: string;
  route: string;
  payload: unknown;
  budgets: BudgetSnapshot;
}

export interface CapabilityResult {
  output: Record<string, unknown>;
  terminationCode: string;
  consumedBudgets: BudgetConsumption;
  metadata?: Record<string, unknown>;
}

export class CapabilityUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CapabilityUnavailableError';
  }
}

export interface CapabilityAdapter {
  supports(route: string): boolean;
  execute(context: CapabilityContext): Promise<CapabilityResult>;
}

export const CAPABILITY_ADAPTERS = Symbol('CAPABILITY_ADAPTERS');

type CapabilityMode = 'placeholder' | 'disabled' | 'local';

function resolveMode(): CapabilityMode {
  const raw = (process.env.CAPABILITY_MODE ?? 'local').toLowerCase();
  if (raw === 'disabled' || raw === 'placeholder' || raw === 'local') {
    return raw;
  }
  return 'local';
}

@Injectable()
export class CapabilityService {
  private readonly mode: CapabilityMode;
  private readonly adapters: CapabilityAdapter[];

  constructor(
    @Optional()
    @Inject(CAPABILITY_ADAPTERS)
    adapters?: CapabilityAdapter[]
  ) {
    this.mode = resolveMode();
    this.adapters = adapters ?? [];
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    if (this.mode === 'disabled') {
      throw new CapabilityUnavailableError('Capability execution disabled by configuration.');
    }

    if (this.mode !== 'placeholder') {
      const adapter = this.adapters.find((candidate) => candidate.supports(context.route));
      if (adapter) {
        return adapter.execute(context);
      }
@Injectable()
export class CapabilityService {
  private readonly placeholdersEnabled =
    (process.env.CAPABILITY_MODE ?? 'placeholder') !== 'disabled';

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    if (!this.placeholdersEnabled) {
      throw new CapabilityUnavailableError('Capability placeholders are disabled.');
    }

    return this.runPlaceholder(context);
  }

  private async runPlaceholder(context: CapabilityContext): Promise<CapabilityResult> {
    const response = {
      message: `Placeholder response for route ${context.route}`,
      intent: context.intent,
      payload_echo: context.payload
    } satisfies Record<string, unknown>;

    const consumed: BudgetConsumption = {
      tokens_prompt_max: Math.min(context.budgets.tokens_prompt_max, 128),
      tokens_output_max: Math.min(context.budgets.tokens_output_max, 256),
      time_ms: Math.min(context.budgets.time_ms, 1000),
      mem_mb: Math.min(context.budgets.mem_mb, 64),
      depth_max: Math.min(context.budgets.depth_max, 1),
      clarifying_questions_max: 0,
      tools_max: 0,
      tool_calls_max: 0,
      web_requests_max: 0,
      code_exec_ms_max: 0
    };

    return {
      output: response,
      terminationCode: 'OK_PLACEHOLDER',
      consumedBudgets: consumed,
      metadata: {
        placeholder: true,
        adapter: 'placeholder'
        placeholder: true
      }
    };
  }
}

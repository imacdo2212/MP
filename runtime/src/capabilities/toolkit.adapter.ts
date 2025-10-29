import { Injectable } from '@nestjs/common';

import type { BudgetConsumption } from '../db/ledger.js';
import type {
  CapabilityAdapter,
  CapabilityContext,
  CapabilityResult
} from './capability.service.js';

interface ToolRequest {
  intent: string;
  parameters?: Record<string, unknown>;
}

interface ToolkitPayload {
  tasks?: string[];
  preferredTools?: string[];
  environment?: string;
}

@Injectable()
export class ToolkitCapabilityAdapter implements CapabilityAdapter {
  supports(route: string): boolean {
    return route.toLowerCase() === 'mptool';
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    const payload = this.normalizePayload(context.payload);
    const playbook = buildPlaybook(context.intent, payload);

    const consumed: BudgetConsumption = {
      tokens_prompt_max: Math.min(context.budgets.tokens_prompt_max, 160),
      tokens_output_max: Math.min(context.budgets.tokens_output_max, 360),
      time_ms: Math.min(context.budgets.time_ms, 900),
      mem_mb: Math.min(context.budgets.mem_mb, 80),
      depth_max: Math.min(context.budgets.depth_max, 2),
      clarifying_questions_max: 0,
      tools_max: Math.min(context.budgets.tools_max ?? 0, 3),
      tool_calls_max: Math.min(context.budgets.tool_calls_max ?? 0, 6),
      web_requests_max: Math.min(context.budgets.web_requests_max ?? 0, 3),
      code_exec_ms_max: Math.min(context.budgets.code_exec_ms_max ?? 0, 1_000)
    };

    return {
      terminationCode: 'OK_MPTOOL_PLAYBOOK',
      consumedBudgets: consumed,
      output: {
        requestedTasks: payload.tasks,
        recommendedTools: playbook.recommendedTools,
        executionPlan: playbook.executionPlan,
        fallbacks: playbook.fallbacks,
        environment: payload.environment ?? null
      },
      metadata: {
        adapter: 'mptool',
        placeholder: false
      }
    } satisfies CapabilityResult;
  }

  private normalizePayload(payload: unknown): ToolkitPayload {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    const input = payload as Record<string, unknown>;
    const normalized: ToolkitPayload = {};

    if (Array.isArray(input.tasks)) {
      normalized.tasks = input.tasks
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((value) => value.length > 0);
    }

    if (Array.isArray(input.preferredTools)) {
      normalized.preferredTools = input.preferredTools
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((value) => value.length > 0);
    }

    if (typeof input.environment === 'string') {
      normalized.environment = input.environment.trim();
    }

    return normalized;
  }
}

interface Playbook {
  recommendedTools: ToolRequest[];
  executionPlan: Array<{ step: string; tool?: string; rationale: string }>;
  fallbacks: string[];
}

function buildPlaybook(intent: string, payload: ToolkitPayload): Playbook {
  const normalizedIntent = intent.toLowerCase();
  const recommendedTools: ToolRequest[] = [];
  const executionPlan: Array<{ step: string; tool?: string; rationale: string }> = [];
  const fallbacks = new Set<string>();

  const primaryTools = payload.preferredTools ?? inferToolsFromIntent(normalizedIntent);

  let stepIndex = 1;
  for (const tool of primaryTools) {
    recommendedTools.push({ intent: tool, parameters: buildParameters(tool, payload) });
    executionPlan.push({
      step: `Step ${stepIndex++}: Execute ${tool}.`,
      tool,
      rationale: rationaleForTool(tool, normalizedIntent)
    });
  }

  if (recommendedTools.length === 0) {
    fallbacks.add('No specialized tool inferred; rely on orchestrator placeholder.');
  }

  if (!payload.tasks || payload.tasks.length === 0) {
    fallbacks.add('Request clarifying tasks from caller before execution.');
  }

  executionPlan.push({
    step: `Step ${stepIndex++}: Aggregate outputs and validate against tasks.`,
    rationale: 'Ensure tool results satisfy requested objectives.'
  });

  fallbacks.add('If any tool fails, surface refusal BOUND_* with partial summary.');

  return {
    recommendedTools,
    executionPlan,
    fallbacks: Array.from(fallbacks)
  } satisfies Playbook;
}

function inferToolsFromIntent(intent: string): string[] {
  const inferred: string[] = [];

  if (intent.includes('search')) {
    inferred.push('tool.webSearch');
  }
  if (intent.includes('dataset') || intent.includes('data')) {
    inferred.push('tool.datasetLookup');
  }
  if (intent.includes('summar')) {
    inferred.push('tool.summarize');
  }

  return inferred;
}

function buildParameters(tool: string, payload: ToolkitPayload): Record<string, unknown> | undefined {
  if (tool === 'tool.datasetLookup') {
    return { filters: payload.tasks ?? [] };
  }
  if (tool === 'tool.webSearch') {
    return { query: payload.tasks?.[0] ?? payload.environment ?? 'general research' };
  }
  if (tool === 'tool.summarize') {
    return { focus: payload.tasks?.join('; ') ?? 'requested tasks' };
  }

  return undefined;
}

function rationaleForTool(tool: string, intent: string): string {
  if (tool === 'tool.webSearch') {
    return 'Gather latest indexed information relevant to request intent.';
  }
  if (tool === 'tool.datasetLookup') {
    return 'Fetch structured dataset matching filters to support analysis.';
  }
  if (tool === 'tool.summarize') {
    return 'Condense multi-tool outputs into bounded response.';
  }
  return `Support intent "${intent}" with generic capability.`;
}


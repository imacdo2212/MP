import { Injectable } from '@nestjs/common';

import type { BudgetConsumption } from '../db/ledger.js';
import type {
  CapabilityAdapter,
  CapabilityContext,
  CapabilityResult
} from './capability.service.js';
import { CapabilityUnavailableError } from './capability.service.js';

interface EngineeringPayload {
  objective?: string;
  stack?: string[];
  constraints?: string[];
  repoState?: string;
  risks?: string[];
  acceptanceCriteria?: string[];
}

interface WorkstreamPlan {
  phases: Array<{ name: string; goals: string[]; deliverables: string[] }>;
  tasks: Array<{ id: string; description: string; owners: string[] }>;
  risks: Array<{ item: string; mitigation: string }>;
  metrics: string[];
}

@Injectable()
export class EngineeringCapabilityAdapter implements CapabilityAdapter {
  supports(route: string): boolean {
    return route.toLowerCase() === 'mpe';
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    const payload = this.normalizePayload(context.payload);

    if (!payload.objective) {
      throw new CapabilityUnavailableError('Engineering adapter requires a project objective.');
    }

    const plan = buildPlan(payload);

    const consumed: BudgetConsumption = {
      tokens_prompt_max: Math.min(context.budgets.tokens_prompt_max, 280),
      tokens_output_max: Math.min(context.budgets.tokens_output_max, 680),
      time_ms: Math.min(context.budgets.time_ms, 1_800),
      mem_mb: Math.min(context.budgets.mem_mb, 128),
      depth_max: Math.min(context.budgets.depth_max, 3),
      clarifying_questions_max: 0,
      tools_max: 0,
      tool_calls_max: 0,
      web_requests_max: 0,
      code_exec_ms_max: 0
    };

    return {
      terminationCode: 'OK_MPE_WORKPLAN',
      consumedBudgets: consumed,
      output: {
        objective: payload.objective,
        stack: payload.stack,
        constraints: payload.constraints,
        acceptanceCriteria: payload.acceptanceCriteria,
        workstream: plan
      },
      metadata: {
        adapter: 'engineering',
        placeholder: false
      }
    } satisfies CapabilityResult;
  }

  private normalizePayload(payload: unknown): EngineeringPayload {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    const input = payload as Record<string, unknown>;
    const normalized: EngineeringPayload = {};

    if (typeof input.objective === 'string') {
      normalized.objective = input.objective.trim();
    }

    if (Array.isArray(input.stack)) {
      normalized.stack = input.stack
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((value) => value.length > 0);
    }

    if (Array.isArray(input.constraints)) {
      normalized.constraints = input.constraints
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((value) => value.length > 0);
    }

    if (Array.isArray(input.risks)) {
      normalized.risks = input.risks
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((value) => value.length > 0);
    }

    if (Array.isArray(input.acceptanceCriteria)) {
      normalized.acceptanceCriteria = input.acceptanceCriteria
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((value) => value.length > 0);
    }

    if (typeof input.repoState === 'string') {
      normalized.repoState = input.repoState.trim();
    }

    return normalized;
  }
}

function buildPlan(payload: EngineeringPayload): WorkstreamPlan {
  const phases: WorkstreamPlan['phases'] = [];

  phases.push({
    name: 'Discovery & Alignment',
    goals: [
      `Clarify current state${payload.repoState ? `: ${payload.repoState}` : ''}.`,
      'Confirm success metrics and rollout sequencing.'
    ],
    deliverables: ['Architecture decision record', 'Updated backlog scoped to MVP']
  });

  phases.push({
    name: 'Implementation',
    goals: ['Implement core slices end-to-end.', 'Instrument telemetry and observability.'],
    deliverables: ['Merge-ready pull requests', 'Integration tests covering primary flows']
  });

  phases.push({
    name: 'Stabilization & Rollout',
    goals: ['Run smoke/regression suite.', 'Pilot release with rollback plan.'],
    deliverables: ['Release notes', 'Runbook and operational checklist']
  });

  const tasks = deriveTasks(payload);
  const risks = deriveRiskMatrix(payload);
  const metrics = deriveMetrics(payload);

  return {
    phases,
    tasks,
    risks,
    metrics
  } satisfies WorkstreamPlan;
}

function deriveTasks(payload: EngineeringPayload): WorkstreamPlan['tasks'] {
  const tasks: WorkstreamPlan['tasks'] = [];

  tasks.push({
    id: 'T1',
    description: `Establish architecture baseline for ${payload.objective}.`,
    owners: ['Engineering lead']
  });

  if ((payload.stack ?? []).length > 0) {
    tasks.push({
      id: 'T2',
      description: `Create reference implementation using ${payload.stack?.join(', ')}.`,
      owners: ['Feature team']
    });
  }

  tasks.push({
    id: 'T3',
    description: 'Author automated tests and CI gating.',
    owners: ['QA', 'Engineering']
  });

  if (payload.constraints && payload.constraints.length > 0) {
    tasks.push({
      id: 'T4',
      description: `Mitigate constraint: ${payload.constraints[0]}.`,
      owners: ['Engineering', 'Product']
    });
  }

  return tasks;
}

function deriveRiskMatrix(payload: EngineeringPayload): WorkstreamPlan['risks'] {
  const risks: WorkstreamPlan['risks'] = [];

  for (const entry of payload.risks ?? []) {
    risks.push({
      item: entry,
      mitigation: `Establish monitoring or guardrail for ${entry.toLowerCase()}.`
    });
  }

  if ((payload.risks ?? []).length === 0) {
    risks.push({
      item: 'Unvalidated assumptions',
      mitigation: 'Schedule design review and spike unknowns early.'
    });
  }

  return risks;
}

function deriveMetrics(payload: EngineeringPayload): string[] {
  const metrics = new Set<string>([
    'Lead time for changes',
    'Deployment frequency',
    'Change failure rate'
  ]);

  if ((payload.acceptanceCriteria ?? []).length > 0) {
    const [firstCriterion] = payload.acceptanceCriteria ?? [];
    if (firstCriterion) {
      metrics.add(`Acceptance tests pass rate for: ${firstCriterion}.`);
    }
  }

  metrics.add('Telemetry coverage for key service interactions.');

  return Array.from(metrics);
}


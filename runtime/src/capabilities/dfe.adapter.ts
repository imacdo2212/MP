import { Injectable } from '@nestjs/common';

import type { BudgetConsumption } from '../db/ledger.js';
import type {
  CapabilityAdapter,
  CapabilityContext,
  CapabilityResult
} from './capability.service.js';
import { CapabilityUnavailableError } from './capability.service.js';

interface LearningObjective {
  topic: string;
  competency?: 'emerging' | 'developing' | 'secure';
}

interface Observation {
  note: string;
  evidenceType?: 'assessment' | 'anecdotal' | 'attendance';
}

interface DfePayload {
  learner?: string;
  age?: number;
  objectives?: LearningObjective[];
  observations?: Observation[];
  targetOutcomes?: string[];
  constraints?: string[];
  focusArea?: string;
}

interface LearningPlan {
  focusArea: string | null;
  sequence: Array<{ step: string; purpose: string }>;
  practiceIdeas: string[];
  evidenceToCollect: string[];
}

@Injectable()
export class DfeCapabilityAdapter implements CapabilityAdapter {
  supports(route: string): boolean {
    return route.toLowerCase() === 'mpa.dfe';
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    const payload = this.normalizePayload(context.payload);

    if (!payload.learner && (!payload.objectives || payload.objectives.length === 0)) {
      throw new CapabilityUnavailableError(
        'DfE adapter requires a learner name or at least one learning objective.'
      );
    }

    const focus = determineFocus(payload);
    const plan = buildLearningPlan(payload, focus);
    const successCriteria = deriveSuccessCriteria(payload);
    const gaps = identifyGaps(payload);

    const consumed: BudgetConsumption = {
      tokens_prompt_max: Math.min(context.budgets.tokens_prompt_max, 220),
      tokens_output_max: Math.min(context.budgets.tokens_output_max, 520),
      time_ms: Math.min(context.budgets.time_ms, 1_200),
      mem_mb: Math.min(context.budgets.mem_mb, 96),
      depth_max: Math.min(context.budgets.depth_max, 2),
      clarifying_questions_max: 0,
      tools_max: 0,
      tool_calls_max: 0,
      web_requests_max: 0,
      code_exec_ms_max: 0
    };

    return {
      terminationCode: 'OK_DFE_LESSON_PLAN',
      consumedBudgets: consumed,
      output: {
        learner: payload.learner ?? null,
        age: payload.age ?? null,
        focusArea: focus,
        learningPlan: plan,
        successCriteria,
        observedEvidence: payload.observations ?? [],
        constraints: payload.constraints ?? [],
        targetOutcomes: payload.targetOutcomes ?? []
      },
      metadata: {
        adapter: 'dfe',
        placeholder: false
      }
    } satisfies CapabilityResult;
  }

  private normalizePayload(payload: unknown): DfePayload {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    const input = payload as Record<string, unknown>;
    const normalized: DfePayload = {};

    if (typeof input.learner === 'string') {
      normalized.learner = input.learner.trim();
    }

    if (typeof input.age === 'number' && Number.isFinite(input.age)) {
      normalized.age = Math.max(3, Math.min(25, Math.round(input.age)));
    }

    if (Array.isArray(input.objectives)) {
      normalized.objectives = input.objectives
        .map((item) => normalizeObjective(item))
        .filter((objective) => objective !== null) as LearningObjective[];
    }

    if (Array.isArray(input.observations)) {
      normalized.observations = input.observations
        .map((item) => normalizeObservation(item))
        .filter((observation) => observation !== null) as Observation[];
    }

    if (Array.isArray(input.targetOutcomes)) {
      normalized.targetOutcomes = input.targetOutcomes
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((value) => value.length > 0);
    }

    if (Array.isArray(input.constraints)) {
      normalized.constraints = input.constraints
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((value) => value.length > 0);
    }

    if (typeof input.focusArea === 'string') {
      normalized.focusArea = input.focusArea.trim();
    }

    return normalized;
  }
}

function normalizeObjective(entry: unknown): LearningObjective | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const item = entry as Record<string, unknown>;
  if (typeof item.topic !== 'string' || item.topic.trim().length === 0) {
    return null;
  }

  const normalized: LearningObjective = { topic: item.topic.trim() };

  if (
    typeof item.competency === 'string' &&
    ['emerging', 'developing', 'secure'].includes(item.competency.toLowerCase())
  ) {
    normalized.competency = item.competency.toLowerCase() as LearningObjective['competency'];
  }

  return normalized;
}

function normalizeObservation(entry: unknown): Observation | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const item = entry as Record<string, unknown>;
  if (typeof item.note !== 'string' || item.note.trim().length === 0) {
    return null;
  }

  const normalized: Observation = { note: item.note.trim() };

  if (
    typeof item.evidenceType === 'string' &&
    ['assessment', 'anecdotal', 'attendance'].includes(item.evidenceType.toLowerCase())
  ) {
    normalized.evidenceType = item.evidenceType.toLowerCase() as Observation['evidenceType'];
  }

  return normalized;
}

function determineFocus(payload: DfePayload): string | null {
  if (payload.focusArea && payload.focusArea.length > 0) {
    return payload.focusArea;
  }

  const objectives = payload.objectives ?? [];
  if (objectives.length === 0) {
    return null;
  }

  const priority = objectives.find((objective) => objective.competency === 'emerging');
  if (priority) {
    return priority.topic;
  }

  return objectives[0]?.topic ?? null;
}

function buildLearningPlan(payload: DfePayload, focusArea: string | null): LearningPlan {
  const sequence: Array<{ step: string; purpose: string }> = [];
  const practiceIdeas: string[] = [];

  const target = focusArea ?? 'priority concept';
  sequence.push({ step: `Activate prior knowledge about ${target}.`, purpose: 'Diagnostic opener' });
  sequence.push({ step: `Model exemplar for ${target}.`, purpose: 'Teacher modelling' });
  sequence.push({ step: `Guided practice on ${target} with scaffolds.`, purpose: 'Shared application' });
  sequence.push({ step: `Independent task demonstrating ${target}.`, purpose: 'Assess mastery' });

  practiceIdeas.push(`Use think-pair-share to surface misconceptions on ${target}.`);
  practiceIdeas.push(`Provide manipulatives or visuals linking ${target} to real contexts.`);
  practiceIdeas.push(`Differentiate exit tickets with tiered prompts on ${target}.`);

  const evidenceToCollect = deriveEvidence(payload);

  return {
    focusArea,
    sequence,
    practiceIdeas,
    evidenceToCollect
  } satisfies LearningPlan;
}

function deriveEvidence(payload: DfePayload): string[] {
  const suggestions = new Set<string>();

  suggestions.add('Exit tickets capturing independent understanding.');
  suggestions.add('Photographs or samples of learner work.');

  for (const observation of payload.observations ?? []) {
    if (observation.evidenceType === 'assessment') {
      suggestions.add('Scores from formative quizzes or mini-assessments.');
    }
    if (observation.evidenceType === 'attendance') {
      suggestions.add('Attendance or punctuality record for trend analysis.');
    }
  }

  return Array.from(suggestions);
}

function deriveSuccessCriteria(payload: DfePayload): string[] {
  const criteria = new Set<string>();

  for (const objective of payload.objectives ?? []) {
    criteria.add(`Learner can demonstrate ${objective.topic} without scaffolds.`);
    if (objective.competency === 'emerging') {
      criteria.add(`Learner can explain ${objective.topic} using correct academic language.`);
    }
  }

  if (payload.targetOutcomes) {
    for (const outcome of payload.targetOutcomes) {
      criteria.add(`Progress evidenced toward outcome: ${outcome}.`);
    }
  }

  if (criteria.size === 0) {
    criteria.add('Learner meets lesson objective with 80% accuracy.');
  }

  return Array.from(criteria);
}

function identifyGaps(payload: DfePayload): string[] {
  const gaps = new Set<string>();

  for (const objective of payload.objectives ?? []) {
    if (objective.competency === 'emerging') {
      gaps.add(`Foundational understanding of ${objective.topic}.`);
    }
    if (objective.competency === 'developing') {
      gaps.add(`Fluency and automaticity for ${objective.topic}.`);
    }
  }

  if ((payload.observations ?? []).length === 0) {
    gaps.add('Limited observational evidence available; gather formative notes.');
  }

  if ((payload.constraints ?? []).length > 0) {
    for (const constraint of payload.constraints ?? []) {
      gaps.add(`Plan accounts for constraint: ${constraint}.`);
    }
  }

  return Array.from(gaps);
}


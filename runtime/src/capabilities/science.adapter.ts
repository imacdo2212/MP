import { Injectable } from '@nestjs/common';

import type { BudgetConsumption } from '../db/ledger.js';
import type {
  CapabilityAdapter,
  CapabilityContext,
  CapabilityResult
} from './capability.service.js';
import { CapabilityUnavailableError } from './capability.service.js';

interface DataPoint {
  label: string;
  value: number;
}

interface SciencePayload {
  question?: string;
  hypothesis?: string;
  dataset?: DataPoint[];
  method?: string;
  constraints?: string[];
}

interface AnalysisFrame {
  hypothesis: string | null;
  descriptiveStats: Record<string, number>;
  evidenceSummary: string[];
  nextExperiments: string[];
  riskAssessment: string[];
}

@Injectable()
export class ScienceCapabilityAdapter implements CapabilityAdapter {
  supports(route: string): boolean {
    return route.toLowerCase() === 'mps';
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    const payload = this.normalizePayload(context.payload);

    if (!payload.question) {
      throw new CapabilityUnavailableError('Science adapter requires a research question.');
    }

    const analysis = buildAnalysis(payload);

    const consumed: BudgetConsumption = {
      tokens_prompt_max: Math.min(context.budgets.tokens_prompt_max, 240),
      tokens_output_max: Math.min(context.budgets.tokens_output_max, 580),
      time_ms: Math.min(context.budgets.time_ms, 1_400),
      mem_mb: Math.min(context.budgets.mem_mb, 96),
      depth_max: Math.min(context.budgets.depth_max, 3),
      clarifying_questions_max: 0,
      tools_max: 0,
      tool_calls_max: 0,
      web_requests_max: 0,
      code_exec_ms_max: 0
    };

    return {
      terminationCode: 'OK_MPS_ANALYSIS',
      consumedBudgets: consumed,
      output: {
        question: payload.question,
        hypothesis: analysis.hypothesis,
        analysis,
        dataset: payload.dataset ?? [],
        constraints: payload.constraints ?? []
      },
      metadata: {
        adapter: 'science',
        placeholder: false
      }
    } satisfies CapabilityResult;
  }

  private normalizePayload(payload: unknown): SciencePayload {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    const input = payload as Record<string, unknown>;
    const normalized: SciencePayload = {};

    if (typeof input.question === 'string') {
      normalized.question = input.question.trim();
    }

    if (typeof input.hypothesis === 'string') {
      normalized.hypothesis = input.hypothesis.trim();
    }

    if (Array.isArray(input.constraints)) {
      normalized.constraints = input.constraints
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((value) => value.length > 0);
    }

    if (typeof input.method === 'string') {
      normalized.method = input.method.trim();
    }

    if (Array.isArray(input.dataset)) {
      normalized.dataset = input.dataset
        .map((item) => normalizeDataPoint(item))
        .filter((value) => value !== null) as DataPoint[];
    }

    return normalized;
  }
}

function normalizeDataPoint(entry: unknown): DataPoint | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const item = entry as Record<string, unknown>;
  if (typeof item.label !== 'string' || typeof item.value !== 'number' || !Number.isFinite(item.value)) {
    return null;
  }

  return { label: item.label.trim(), value: Number(item.value) };
}

function buildAnalysis(payload: SciencePayload): AnalysisFrame {
  const dataset = payload.dataset ?? [];
  const stats = computeStats(dataset);
  const evidenceSummary = summarizeEvidence(payload, stats);
  const nextExperiments = proposeExperiments(payload);
  const riskAssessment = assessRisks(payload, dataset);

  return {
    hypothesis: payload.hypothesis ?? null,
    descriptiveStats: stats,
    evidenceSummary,
    nextExperiments,
    riskAssessment
  } satisfies AnalysisFrame;
}

function computeStats(dataset: DataPoint[]): Record<string, number> {
  if (dataset.length === 0) {
    return { count: 0 };
  }

  const values = dataset.map((point) => point.value);
  const sum = values.reduce((acc, value) => acc + value, 0);
  const mean = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const variance =
    values.length > 1
      ? values.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / (values.length - 1)
      : 0;
  const stdDev = Math.sqrt(variance);

  return {
    count: values.length,
    mean: Number(mean.toFixed(3)),
    min,
    max,
    stdDev: Number(stdDev.toFixed(3))
  };
}

function summarizeEvidence(payload: SciencePayload, stats: Record<string, number>): string[] {
  const summary: string[] = [];

  if ((payload.dataset ?? []).length === 0) {
    summary.push('No empirical dataset supplied; relying on theoretical reasoning.');
  } else {
    summary.push(
      `Dataset of ${stats.count} observations with mean ${stats.mean} (min ${stats.min}, max ${stats.max}).`
    );
    if (stats.stdDev > stats.mean * 0.5) {
      summary.push('High variability detected; consider stratifying samples.');
    }
  }

  if (payload.method) {
    summary.push(`Stated method: ${payload.method}.`);
  }

  if (payload.hypothesis) {
    summary.push(`Hypothesis under test: ${payload.hypothesis}.`);
  }

  return summary;
}

function proposeExperiments(payload: SciencePayload): string[] {
  const experiments = new Set<string>();

  experiments.add('Run control vs. experimental comparison with random assignment.');
  experiments.add('Collect additional replicates to improve statistical power.');

  if (payload.method?.toLowerCase().includes('simulation')) {
    experiments.add('Validate simulation output against real-world benchmark dataset.');
  }

  if ((payload.constraints ?? []).includes('limited budget')) {
    experiments.add('Prioritize low-cost observational study before large trials.');
  }

  return Array.from(experiments);
}

function assessRisks(payload: SciencePayload, dataset: DataPoint[]): string[] {
  const risks = new Set<string>();

  if (dataset.length < 10) {
    risks.add('Sample size may be insufficient for robust inference.');
  }

  if (!payload.method) {
    risks.add('Experimental method unspecified; risk of reproducibility gaps.');
  }

  if ((payload.constraints ?? []).length > 0) {
    risks.add(`Constraints noted: ${(payload.constraints ?? []).join(', ')}.`);
  }

  if (!payload.hypothesis) {
    risks.add('No explicit hypothesis; clarify measurable prediction.');
  }

  return Array.from(risks);
}


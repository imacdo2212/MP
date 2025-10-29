import { Injectable } from '@nestjs/common';

import type { BudgetConsumption } from '../db/ledger.js';
import type {
  CapabilityAdapter,
  CapabilityContext,
  CapabilityResult
} from './capability.service.js';
import { CapabilityUnavailableError } from './capability.service.js';

interface VitalSnapshot {
  heartRate?: number;
  systolic?: number;
  diastolic?: number;
  temperatureC?: number;
  spo2?: number;
}

interface DoctorMartinPayload {
  chiefComplaint?: string;
  symptoms?: string[];
  onset?: string;
  durationMinutes?: number;
  vitals?: VitalSnapshot;
  medications?: string[];
  history?: string[];
}

interface TriageAssessment {
  disposition: 'emergent' | 'urgent' | 'routine';
  rationale: string[];
}

interface Recommendation {
  action: string;
  urgency: 'now' | 'soon' | 'monitor';
  reasoning: string;
}

@Injectable()
export class DoctorMartinCapabilityAdapter implements CapabilityAdapter {
  supports(route: string): boolean {
    return route.toLowerCase() === 'mpa.doctormartin';
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    const payload = this.normalizePayload(context.payload);

    if (!payload.chiefComplaint && (!payload.symptoms || payload.symptoms.length === 0)) {
      throw new CapabilityUnavailableError(
        'DoctorMartin adapter requires at least a chief complaint or symptom list.'
      );
    }

    const vitalsAssessment = assessVitals(payload.vitals);
    const symptomAssessment = assessSymptoms(payload);
    const triage = mergeAssessments(vitalsAssessment, symptomAssessment);
    const recommendations = buildRecommendations(triage, payload);
    const redFlags = collectRedFlags(vitalsAssessment, symptomAssessment);

    const consumed: BudgetConsumption = {
      tokens_prompt_max: Math.min(context.budgets.tokens_prompt_max, 256),
      tokens_output_max: Math.min(context.budgets.tokens_output_max, 600),
      time_ms: Math.min(context.budgets.time_ms, 1_500),
      mem_mb: Math.min(context.budgets.mem_mb, 96),
      depth_max: Math.min(context.budgets.depth_max, 2),
      clarifying_questions_max: 0,
      tools_max: 0,
      tool_calls_max: 0,
      web_requests_max: 0,
      code_exec_ms_max: 0
    };

    return {
      terminationCode: 'OK_DOCTORMARTIN_TRIAGE',
      consumedBudgets: consumed,
      output: {
        chiefComplaint: payload.chiefComplaint ?? null,
        summarizedSymptoms: symptomAssessment.keySymptoms,
        vitals: payload.vitals ?? null,
        triage,
        recommendations,
        redFlags,
        history: payload.history ?? [],
        medications: payload.medications ?? [],
        onset: payload.onset ?? null,
        durationMinutes: payload.durationMinutes ?? null
      },
      metadata: {
        adapter: 'doctor-martin',
        placeholder: false
      }
    } satisfies CapabilityResult;
  }

  private normalizePayload(payload: unknown): DoctorMartinPayload {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    const input = payload as Record<string, unknown>;
    const normalized: DoctorMartinPayload = {};

    if (typeof input.chiefComplaint === 'string') {
      normalized.chiefComplaint = input.chiefComplaint.trim();
    }

    if (Array.isArray(input.symptoms)) {
      normalized.symptoms = input.symptoms
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((symptom) => symptom.length > 0);
    }

    if (typeof input.onset === 'string') {
      normalized.onset = input.onset.trim();
    }

    if (typeof input.durationMinutes === 'number' && Number.isFinite(input.durationMinutes)) {
      normalized.durationMinutes = Math.max(0, Math.round(input.durationMinutes));
    }

    if (Array.isArray(input.medications)) {
      normalized.medications = input.medications
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((value) => value.length > 0);
    }

    if (Array.isArray(input.history)) {
      normalized.history = input.history
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((value) => value.length > 0);
    }

    if (input.vitals && typeof input.vitals === 'object') {
      const vitals = input.vitals as Record<string, unknown>;
      normalized.vitals = {};

      if (typeof vitals.heartRate === 'number' && Number.isFinite(vitals.heartRate)) {
        normalized.vitals.heartRate = Math.round(vitals.heartRate);
      }

      if (typeof vitals.systolic === 'number' && Number.isFinite(vitals.systolic)) {
        normalized.vitals.systolic = Math.round(vitals.systolic);
      }

      if (typeof vitals.diastolic === 'number' && Number.isFinite(vitals.diastolic)) {
        normalized.vitals.diastolic = Math.round(vitals.diastolic);
      }

      if (typeof vitals.temperatureC === 'number' && Number.isFinite(vitals.temperatureC)) {
        normalized.vitals.temperatureC = Number(vitals.temperatureC.toFixed(1));
      }

      if (typeof vitals.spo2 === 'number' && Number.isFinite(vitals.spo2)) {
        normalized.vitals.spo2 = Math.round(vitals.spo2);
      }

      if (Object.keys(normalized.vitals).length === 0) {
        delete normalized.vitals;
      }
    }

    return normalized;
  }
}

interface AssessmentArtifacts {
  disposition: TriageAssessment['disposition'];
  rationale: string[];
  keySymptoms: string[];
  redFlags: string[];
}

function assessVitals(vitals: VitalSnapshot | undefined): AssessmentArtifacts {
  if (!vitals) {
    return {
      disposition: 'routine',
      rationale: ['No vital signs supplied; defaulting to routine assessment.'],
      keySymptoms: [],
      redFlags: []
    };
  }

  const rationale: string[] = [];
  const redFlags: string[] = [];
  let disposition: TriageAssessment['disposition'] = 'routine';

  if (typeof vitals.heartRate === 'number') {
    if (vitals.heartRate >= 130 || vitals.heartRate <= 40) {
      disposition = 'emergent';
      rationale.push(`Marked heart rate abnormality detected (${vitals.heartRate} bpm).`);
      redFlags.push('Extreme tachycardia/bradycardia.');
    } else if (vitals.heartRate >= 110) {
      disposition = elevateDisposition(disposition, 'urgent');
      rationale.push(`Tachycardia noted (${vitals.heartRate} bpm).`);
    }
  }

  if (typeof vitals.systolic === 'number') {
    if (vitals.systolic >= 180) {
      disposition = 'emergent';
      rationale.push(`Severely elevated systolic blood pressure (${vitals.systolic} mmHg).`);
      redFlags.push('Possible hypertensive emergency.');
    } else if (vitals.systolic <= 90) {
      disposition = 'emergent';
      rationale.push(`Hypotension detected (${vitals.systolic} mmHg).`);
      redFlags.push('Potential shock or sepsis.');
    } else if (vitals.systolic >= 160) {
      disposition = elevateDisposition(disposition, 'urgent');
      rationale.push(`Hypertension noted (${vitals.systolic} mmHg).`);
    }
  }

  if (typeof vitals.temperatureC === 'number') {
    if (vitals.temperatureC >= 39.4) {
      disposition = elevateDisposition(disposition, 'urgent');
      rationale.push(`High fever (${vitals.temperatureC.toFixed(1)}°C).`);
    } else if (vitals.temperatureC <= 35) {
      disposition = 'emergent';
      rationale.push(`Hypothermia range temperature (${vitals.temperatureC.toFixed(1)}°C).`);
      redFlags.push('Hypothermia or sepsis risk.');
    }
  }

  if (typeof vitals.spo2 === 'number') {
    if (vitals.spo2 < 90) {
      disposition = 'emergent';
      rationale.push(`Critically low oxygen saturation (${vitals.spo2}%).`);
      redFlags.push('Possible hypoxemia; immediate oxygen support needed.');
    } else if (vitals.spo2 < 94) {
      disposition = elevateDisposition(disposition, 'urgent');
      rationale.push(`Low oxygen saturation (${vitals.spo2}%).`);
    }
  }

  if (rationale.length === 0) {
    rationale.push('Vitals within typical ranges for triage.');
  }

  return {
    disposition,
    rationale,
    keySymptoms: [],
    redFlags
  };
}

function assessSymptoms(payload: DoctorMartinPayload): AssessmentArtifacts {
  const symptoms = payload.symptoms ?? [];
  const lowerSymptoms = symptoms.map((symptom) => symptom.toLowerCase());
  const rationale: string[] = [];
  const redFlags: string[] = [];
  let disposition: TriageAssessment['disposition'] = 'routine';

  const emergentKeywords = [
    'chest pain',
    'shortness of breath',
    'stroke',
    'severe bleeding',
    'loss of consciousness',
    'anaphylaxis'
  ];

  const urgentKeywords = ['fever', 'vomiting', 'abdominal pain', 'fracture', 'asthma', 'infection'];

  for (const keyword of emergentKeywords) {
    if (lowerSymptoms.some((symptom) => symptom.includes(keyword))) {
      disposition = 'emergent';
      rationale.push(`Symptom "${keyword}" requires emergency evaluation.`);
      redFlags.push(`Emergency presentation: ${keyword}.`);
    }
  }

  if (disposition !== 'emergent') {
    for (const keyword of urgentKeywords) {
      if (lowerSymptoms.some((symptom) => symptom.includes(keyword))) {
        disposition = elevateDisposition(disposition, 'urgent');
        rationale.push(`Symptom "${keyword}" suggests urgent follow-up.`);
      }
    }
  }

  if (payload.chiefComplaint) {
    const lowerComplaint = payload.chiefComplaint.toLowerCase();
    if (lowerComplaint.includes('chest pain') || lowerComplaint.includes('shortness of breath')) {
      disposition = 'emergent';
      rationale.push('Chief complaint indicates potential cardiopulmonary emergency.');
      redFlags.push('Possible acute coronary syndrome or pulmonary embolism.');
    }
  }

  if (rationale.length === 0) {
    rationale.push('No red-flag symptoms reported; routine assessment appropriate.');
  }

  return {
    disposition,
    rationale,
    keySymptoms: symptoms,
    redFlags
  };
}

function mergeAssessments(
  vitalsAssessment: AssessmentArtifacts,
  symptomAssessment: AssessmentArtifacts
): TriageAssessment {
  const disposition = higherDisposition(vitalsAssessment.disposition, symptomAssessment.disposition);
  const rationale = dedupe([...vitalsAssessment.rationale, ...symptomAssessment.rationale]);

  return {
    disposition,
    rationale
  };
}

function buildRecommendations(
  triage: TriageAssessment,
  payload: DoctorMartinPayload
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (triage.disposition === 'emergent') {
    recommendations.push({
      action: 'Activate emergency medical services or direct to emergency department immediately.',
      urgency: 'now',
      reasoning: triage.rationale[0] ?? 'Emergent clinical indicators present.'
    });
  } else if (triage.disposition === 'urgent') {
    recommendations.push({
      action: 'Arrange urgent evaluation with clinician within 24 hours.',
      urgency: 'soon',
      reasoning: triage.rationale[0] ?? 'Urgent symptoms identified.'
    });
  } else {
    recommendations.push({
      action: 'Schedule routine follow-up and provide self-care guidance.',
      urgency: 'monitor',
      reasoning: triage.rationale[0] ?? 'Routine findings.'
    });
  }

  if ((payload.medications ?? []).length > 0) {
    recommendations.push({
      action: 'Review current medications for interactions or contraindications.',
      urgency: triage.disposition === 'emergent' ? 'now' : 'soon',
      reasoning: 'Medication list supplied by caller.'
    });
  }

  if ((payload.history ?? []).length > 0) {
    recommendations.push({
      action: 'Consider relevant medical history in differential and documentation.',
      urgency: 'monitor',
      reasoning: 'Past history provided.'
    });
  }

  return recommendations;
}

function collectRedFlags(
  vitalsAssessment: AssessmentArtifacts,
  symptomAssessment: AssessmentArtifacts
): string[] {
  return dedupe([...vitalsAssessment.redFlags, ...symptomAssessment.redFlags]);
}

function higherDisposition(
  first: TriageAssessment['disposition'],
  second: TriageAssessment['disposition']
): TriageAssessment['disposition'] {
  const order: Record<TriageAssessment['disposition'], number> = {
    routine: 0,
    urgent: 1,
    emergent: 2
  };

  return order[first] >= order[second] ? first : second;
}

function elevateDisposition(
  current: TriageAssessment['disposition'],
  target: Exclude<TriageAssessment['disposition'], 'routine'>
): TriageAssessment['disposition'] {
  const order: Array<TriageAssessment['disposition']> = ['routine', 'urgent', 'emergent'];
  const currentIndex = order.indexOf(current);
  const targetIndex = order.indexOf(target);
  return order[Math.max(currentIndex, targetIndex)] ?? target;
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}


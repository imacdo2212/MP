import { Injectable } from '@nestjs/common';

import type { BudgetConsumption } from '../db/ledger.js';
import type {
  CapabilityAdapter,
  CapabilityContext,
  CapabilityResult
} from './capability.service.js';
import { CapabilityUnavailableError } from './capability.service.js';

interface RumpolePayload {
  document?: string;
  questions?: string[];
  jurisdiction?: string;
}

interface QuestionAssessment {
  question: string;
  status: 'answered' | 'partial' | 'insufficient';
  evidence: string;
}

interface RiskFlag {
  issue: string;
  severity: 'low' | 'medium' | 'high';
  evidence: string;
}

@Injectable()
export class RumpoleCapabilityAdapter implements CapabilityAdapter {
  supports(route: string): boolean {
    return route.toLowerCase() === 'mpa.rumpole';
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    const payload = this.normalizePayload(context.payload);

    if (!payload.document) {
      throw new CapabilityUnavailableError('Rumpole adapter requires a document payload.');
    }

    const sentences = splitIntoSentences(payload.document);
    const summary = buildSummary(sentences, payload.document);
    const obligations = extractByKeywords(sentences, ['shall', 'must', 'responsible', 'agree']);
    const terminationClauses = extractByKeywords(sentences, ['terminate', 'termination', 'breach', 'expiry']);
    const parties = extractParties(payload.document);
    const effectiveDate = extractEffectiveDate(payload.document);
    const riskFlags = detectRiskFlags(payload.document, terminationClauses);
    const questionAssessments = this.evaluateQuestions(payload.questions, payload.document, obligations);

    const consumed: BudgetConsumption = {
      tokens_prompt_max: Math.min(context.budgets.tokens_prompt_max, estimateTokens(payload.document)),
      tokens_output_max: Math.min(context.budgets.tokens_output_max, 600),
      time_ms: Math.min(context.budgets.time_ms, 2_500),
      mem_mb: Math.min(context.budgets.mem_mb, 128),
      depth_max: Math.min(context.budgets.depth_max, 2),
      clarifying_questions_max: 0,
      tools_max: 0,
      tool_calls_max: 0,
      web_requests_max: 0,
      code_exec_ms_max: 0
    };

    return {
      terminationCode: 'OK_RUMPOLE_ANALYZED',
      consumedBudgets: consumed,
      output: {
        summary,
        jurisdiction: payload.jurisdiction ?? null,
        parties,
        effectiveDate,
        obligations,
        terminationClauses,
        riskFlags,
        questions: questionAssessments,
        documentStats: {
          characters: payload.document.length,
          words: countWords(payload.document)
        }
      },
      metadata: {
        adapter: 'rumpole',
        placeholder: false
      }
    } satisfies CapabilityResult;
  }

  private normalizePayload(payload: unknown): RumpolePayload {
    if (!payload || typeof payload !== 'object') {
      return {};
    }

    const normalized: RumpolePayload = {};
    const input = payload as Record<string, unknown>;

    if (typeof input.document === 'string') {
      normalized.document = input.document.trim();
    }

    if (Array.isArray(input.questions)) {
      normalized.questions = input.questions
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((value) => value.length > 0);
    }

    if (typeof input.jurisdiction === 'string') {
      normalized.jurisdiction = input.jurisdiction.trim();
    }

    return normalized;
  }

  private evaluateQuestions(
    questions: string[] | undefined,
    document: string,
    obligations: string[]
  ): QuestionAssessment[] {
    if (!questions || questions.length === 0) {
      return [];
    }

    const lowerDoc = document.toLowerCase();

    return questions.map((question) => {
      const normalized = question.toLowerCase();
      const keywords = normalized.split(/[^a-z0-9]+/).filter((token) => token.length > 4);
      const matches = keywords.filter((keyword) => lowerDoc.includes(keyword));
      const coverage = keywords.length === 0 ? 0 : matches.length / keywords.length;

      if (coverage >= 0.6) {
        return {
          question,
          status: 'answered',
          evidence: `Keywords matched: ${matches.join(', ')}`
        } satisfies QuestionAssessment;
      }

      if (coverage > 0 || obligations.some((clause) => clause.toLowerCase().includes(matches[0] ?? ''))) {
        return {
          question,
          status: 'partial',
          evidence: matches.length
            ? `Partial keywords matched: ${matches.join(', ')}`
            : 'Related obligation identified.'
        } satisfies QuestionAssessment;
      }

      return {
        question,
        status: 'insufficient',
        evidence: 'No direct references located in the document.'
      } satisfies QuestionAssessment;
    });
  }
}

function splitIntoSentences(document: string): string[] {
  return document
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function buildSummary(sentences: string[], document: string): string {
  if (sentences.length > 0) {
    const preview = sentences.slice(0, 2).join(' ');
    return preview.length > 320 ? `${preview.slice(0, 317)}...` : preview;
  }

  const condensed = document.trim().slice(0, 320);
  return condensed.length === document.trim().length ? condensed : `${condensed}...`;
}

function extractByKeywords(sentences: string[], keywords: string[]): string[] {
  const matchers = keywords.map((keyword) => new RegExp(`\\b${keyword}`, 'i'));
  return sentences.filter((sentence) => matchers.some((regex) => regex.test(sentence)));
}

function extractParties(document: string): string[] {
  const parties = new Set<string>();

  const betweenMatch = document.match(/between\s+([^\n,;.]+?)\s+and\s+([^\n,;.]+?)(?:[\.,;\n]|$)/i);
  if (betweenMatch) {
    parties.add(cleanEntity(betweenMatch[1]));
    parties.add(cleanEntity(betweenMatch[2]));
  }

  const roleMatches = document.matchAll(
    /(Company|Client|Vendor|Supplier|Contractor|Licensee|Licensor|Consultant)\s+([A-Z][A-Za-z0-9& ]+)/g
  );
  for (const match of roleMatches) {
    parties.add(cleanEntity(match[0]));
  }

  const namedEntities = [...document.matchAll(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+)\b/g)].map((match) =>
    cleanEntity(match[1])
  );

  for (const entity of namedEntities) {
    if (!commonStopEntities.has(entity.toLowerCase()) && entity.length > 3) {
      parties.add(entity);
    }
    if (parties.size >= 4) {
      break;
    }
  }

  return Array.from(parties).filter((value) => value.length > 0).slice(0, 4);
}

function extractEffectiveDate(document: string): string | null {
  const fullMonthMatch = document.match(
    /(effective\s+as\s+of\s+)?((January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4})/i
  );
  if (fullMonthMatch) {
    return fullMonthMatch[2];
  }

  const isoMatch = document.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (isoMatch) {
    return isoMatch[0];
  }

  const numericMatch = document.match(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/);
  return numericMatch ? numericMatch[0] : null;
}

function detectRiskFlags(document: string, terminationClauses: string[]): RiskFlag[] {
  const lower = document.toLowerCase();

  const catalog: Array<{ keyword: string; issue: string; severity: RiskFlag['severity'] }> = [
    { keyword: 'indemn', issue: 'Indemnification obligations present', severity: 'high' },
    { keyword: 'liabilit', issue: 'Liability limitations detected', severity: 'medium' },
    { keyword: 'penalt', issue: 'Penalty or liquidated damages referenced', severity: 'medium' },
    { keyword: 'exclusive', issue: 'Exclusivity clause present', severity: 'medium' },
    { keyword: 'confidential', issue: 'Confidentiality clause noted', severity: 'low' }
  ];

  const flags: RiskFlag[] = [];

  for (const entry of catalog) {
    const index = lower.indexOf(entry.keyword);
    if (index === -1) {
      continue;
    }

    const excerpt = document.slice(Math.max(0, index - 40), index + 120).replace(/\s+/g, ' ').trim();
    flags.push({
      issue: entry.issue,
      severity: entry.severity,
      evidence: excerpt
    });
  }

  if (terminationClauses.length === 0) {
    flags.push({
      issue: 'No explicit termination clause located',
      severity: 'medium',
      evidence: 'Contract text did not surface termination triggers or remedies.'
    });
  }

  return flags;
}

function estimateTokens(document: string): number {
  // Rough heuristic assuming ~4 characters per token for English prose.
  return Math.max(64, Math.min(900, Math.round(document.length / 4)));
}

function countWords(document: string): number {
  return document.trim().length === 0 ? 0 : document.trim().split(/\s+/).length;
}

function cleanEntity(entity: string): string {
  return entity.replace(/[^A-Za-z0-9&\s]/g, '').replace(/\s{2,}/g, ' ').trim();
}

const commonStopEntities = new Set<string>(['this agreement', 'the agreement', 'agreement']);

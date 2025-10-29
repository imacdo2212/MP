import type { CapabilityInvocation } from './base.js';

export const LEGAL_SEARCH_CAPABILITY = 'legalSearch' as const;
export type LegalSearchCapabilityName = typeof LEGAL_SEARCH_CAPABILITY;

export interface LegalSearchFilters {
  jurisdictions?: string[];
  courts?: string[];
  fromYear?: number;
  toYear?: number;
}

export interface LegalSearchPayload {
  query: string;
  filters?: LegalSearchFilters;
  maxResults?: number;
}

export interface LegalSearchPrecedentHit {
  id: string;
  title: string;
  score: number;
}

export interface LegalSearchSuccessPayload {
  summary: string;
  precedents: LegalSearchPrecedentHit[];
}

export type LegalSearchInvocation = CapabilityInvocation & {
  name: LegalSearchCapabilityName;
  payload?: LegalSearchPayload;
};

export interface LegalSearchFixtureData {
  summary: string;
  data: {
    precedents: LegalSearchPrecedentHit[];
  };
}

export const LEGAL_SEARCH_FIXTURE: LegalSearchFixtureData = {
  summary: 'Found 2 precedent matches with relevance ≥0.84',
  data: {
    precedents: [
      { id: 'case-1984-01', title: 'Rumpole v. Apex', score: 0.91 },
      { id: 'case-1996-18', title: 'MPA Holdings v. Contoso', score: 0.84 }
    ]
  }
};

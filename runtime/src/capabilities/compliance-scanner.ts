import type { CapabilityInvocation } from './base.js';

export const COMPLIANCE_SCANNER_CAPABILITY = 'complianceScanner' as const;
export type ComplianceScannerCapabilityName = typeof COMPLIANCE_SCANNER_CAPABILITY;

export interface ComplianceScannerPayload {
  documentId: string;
  surface?: 'summary' | 'full';
}

export interface ComplianceAdvisory {
  id: string;
  severity: 'low' | 'medium' | 'high';
  detail: string;
}

export interface ComplianceScannerSuccessPayload {
  summary: string;
  advisories: ComplianceAdvisory[];
}

export type ComplianceScannerInvocation = CapabilityInvocation & {
  name: ComplianceScannerCapabilityName;
  payload?: ComplianceScannerPayload;
};

export interface ComplianceScannerFixtureData {
  summary: string;
  data: {
    advisories: ComplianceAdvisory[];
  };
}

export const COMPLIANCE_SCANNER_FIXTURE: ComplianceScannerFixtureData = {
  summary: 'Risk posture nominal with 1 advisory flag',
  data: {
    advisories: [
      { id: 'adv-14', severity: 'medium', detail: 'Renew SOC2 evidence within 30 days' }
    ]
  }
};

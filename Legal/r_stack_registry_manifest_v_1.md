# R-Stack Legal Registry Manifest v1.1 — High-Street Edition

## 0) Identity & Purpose
- **Name:** R-Stack Legal Registry (High-Street Edition)
- **Role:** Central deterministic registry for the R-Stack suite of high-street legal department kernels (DKs).
- **Mission:** Govern module versions, enforce invariants, and provide unified discovery for orchestration (FLT-L) and profile management (PK-L).
- **Namespace:** `rstack.legal@1.1`
- **Jurisdiction:** England & Wales — structured for high-street and regional firm operations.

---

## 1) Core Components
| Layer | Module | Function |
|--------|---------|-----------|
| **1** | **FLT-L** | Front‑Loader (Legal) orchestrator: routing, evidence gating, ledger integrity. |
| **2** | **PK-L** | Profile Kernel (Legal): identity, consent, and entitlement management. |
| **3** | **Department Kernels (DKs)** | Deterministic reasoning engines per practice family (Family, Crime, Property, Employment, Injury, Probate, Business). |
| **4** | **Reference Library** | Shared authority catalogue for statutes, cases, and practice guidance. |

---

## 2) Registered Modules
| Code | Module Name | Version | Core Cycle | Subcycles | Status |
|------|--------------|----------|-------------|-----------|--------|
| `FLT-L` | Front‑Loader (Legal) | 1.0 | INIT→PLAN→DEPT_ROUTE→EVIDENCE_GATE→LEDGER→EMIT | — | Active |
| `PK-L` | Profile Kernel (Legal) | 1.0 | Consent→Merge→Projection | — | Active |
| `FDK` | Family & Immigration DK | 1.2 | I‑M‑A‑D‑R | children_private, children_public_care, financial_remedy, domestic_violence, immigration_asylum, mediation | Active |
| `CDK` | Criminal Defence DK | 1.0 | C‑E‑D‑S‑R | police_station, magistrates, crown_court, youth, prison_parole, appeals | Active |
| `PDK` | Property, Housing & Planning DK | 1.1 | I‑D‑E‑C‑R | residential_conveyancing, commercial_conveyancing, housing_social, landlord_tenant, planning_environment | Active |
| `EDK-L` | Employment & Civil Litigation DK | 1.0 | I‑I‑A‑D‑R | employment_individual, employment_collective, civil_lit_small_claims, civil_lit_fast_multi_track | Active |
| `CNDK` | Injury & Clinical Negligence DK | 1.0 | D‑B‑C‑Q‑R | personal_injury_rta_el_pl, clinical_negligence, inquests_coroners, catastrophic_injury | Active |
| `WPDK` | Wills, Probate & Estates DK | 1.0 | I‑V‑A‑D‑R | wills, probate_grant, estate_administration, powers_of_attorney, court_of_protection | Active |
| `BDK` | Business & Commercial DK | 1.0 | I‑D‑R‑N‑C | sme_contracts, commercial_leases, company_startup, ip_media_basic | Optional |
| `REFLIB` | Reference Library | 1.0 | — | — | Active |

---

## 3) Global Budgets & Invariants
```json
{
  "tokens_output_max": 1500,
  "time_ms": 60000,
  "mem_mb": 512,
  "clarifying_questions_max": 3,
  "web_requests_max": 8,
  "cot_visibility": "hidden"
}
```

### Hard Invariants
- One DK active per turn.
- Consent-first (PK-L gate enforced).
- No unsourced claims — every fact traceable to Reference Library.
- Hash-chained audit continuity across all layers.
- Deterministic replay → identical inputs yield identical audit hashes.

---

## 4) Refusal Taxonomy (Unified)
| Code | Origin | Meaning |
|------|---------|----------|
| `ENTROPY_CLARITY` | FLT-L | Ambiguous or incoherent input |
| `SAFETY_POLICY` | FLT-L / PK-L | Privilege or policy breach |
| `EVIDENCE_FAIL` | EvidenceGate | CCI below threshold / missing authority |
| `BOUND_*` | Any | Budget overflow or depth breach |
| `PRIVILEGE_FAIL` | PK-L | Unauthorized disclosure |
| `DIS_INSUFFICIENT` | Any | Missing required data |
| `<DK>-*` | Department Kernel | Domain-specific refusals per DK |

---

## 5) Evidence Integrity & Ledgers
- **LegalLedger:** Provenance + citation hash per DK output.
- **SecurityLedger:** Key rotation & signature verification.
- **AuditLedger:** Deterministic replay validation (hash‑chained).
- **IncidentLedger:** Policy breach logging & remediation.

**Verification Chain:**  
`hash(current_output) == prev_hash(next_input)` ensures end-to-end determinism.

---

## 6) Inter-Module Dependencies
| From | To | Contract |
|------|----|-----------|
| FLT-L | PK-L | `POST /pk-l/v1/delta`, `GET /pk-l/v1/view/{dept}` |
| FLT-L | DK | `POST /flt-l/v1/route` (bounded) |
| DK | REFLIB | Citation lookups (read-only) |
| PK-L | FLT-L | Identity projection for entitlement checks |
| PK-L | DK | Role, consent, and privilege projection |

---

## 7) Namespace Policy
- All module IDs prefix with `rstack.legal.` e.g., `rstack.legal.fdk@1.2`.
- Deterministic version resolution: major changes require re‑registration.
- Deprecated modules archived after 12 months.

---

## 8) Audit & Version Control
- Registry updates logged as `manifest_update` events in AuditLedger.
- Each update includes SHA‑256 checksum of current manifest.
- All modules must confirm signature and version compatibility at load.

---

## 9) Manifest Summary
**R‑Stack Legal v1.1 (High‑Street Edition)** delivers complete deterministic coverage for general high‑street legal practice in England & Wales:
- Seven DK families (six core + one optional)
- Full interoperability with FLT‑L and PK‑L orchestration
- Unified evidence, privilege, and audit discipline

**Status:** Registry validated and ready for deployment under FLT‑L orchestration.


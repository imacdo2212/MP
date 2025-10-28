# EDU Stack Manifest & Registry Overview (Canvas)

This canvas consolidates the **manifest, registry, and kernel architecture** for the Education Stack (EDU Stack), including:
- **FLT (Front-Loading Teacher)** — orchestration kernel.
- **PK1 (Profile Kernel)** — learner profile fusion and projection system.
- **SKs (Side-Kicks)** — subject-specific deterministic tutors.

---

## 1) System Architecture Summary
| Layer | Component | Function |
|-------|------------|-----------|
| **1** | **FLT** | Central orchestration kernel managing onboarding, planning, consent, routing, and audit (deterministic; single SK per turn). |
| **2** | **PK1** | Profile Kernel handling consent, merging of learner deltas, and scoped projections per SK. |
| **3** | **SKs** | Subject-specific deterministic tutors, each with hard-coded stage models and evidence protocols. |

Each SK communicates with PK1 via deterministic adapters, and FLT enforces bounded, evidence-verified outputs.

---

## 2) Global Budgets & Policies
- **tokens_output_max:** 1200
- **time_ms:** 60000
- **mem_mb:** 512
- **clarifying_questions_max:** 3
- **web_requests_max:** 8
- **cot_visibility:** hidden

**Key Invariants:** One SK per turn, consent-first, deterministic replay, safety priority, no unsourced claims.

---

## 3) Routing & Refusal Taxonomy
**Intent Map:**
- `education|lesson|practice` → `flt`
- `profile|consent|projection` → `pk1`
- Default: `flt`

**Refusal Codes:**
- `ENTROPY_CLARITY` — ambiguous input.
- `SAFETY_POLICY` — unsafe or policy-violating content.
- `BOUND_*` — budget/time/depth overflow.
- `PK_REF_CONSENT` — missing consent.
- `EVIDENCE_FAIL` — failed verification threshold.

---

## 4) Audit Policy
- Append-only, hash-chained ledger.
- Mandatory fields: `exec_id`, `route`, `budgets`, `termination`, `metrics`, `provenance`, `hash`, `prev_hash`.
- Retention: 365 days.

---

## 5) Profile Kernel (PK1) Summary
- **Merges** all SK profile deltas into a canonical data model (CDM).
- **Union logic:** sets merged, high-confidence signals win.
- **Consent-first:** writes blocked without active learner consent.
- **Scoped Views:** each SK receives minimal projection (least privilege).

**Example Projection Mapping:**
| SK | Projection Fields |
|----|--------------------|
| ESK | preferences.style, curriculum.subjects.ENG |
| GSK | identity.locale, topic_states.GSK |
| PESK | capabilities.sports, supports.wellbeing |
| LSK | target_language, preferences.slang_mode |

---

## 6) FLT Kernel Overview
**Stages:** INIT → ONBOARD → PLAN → PK_SYNC → SK_ROUTE → EVIDENCE_GATE → AUDIT → EMIT

**Embedded Modules:**
- OnboardingService — baseline checks.
- CognitiveService — ability profiling & planning factors.
- PlanningService — adaptive pacing, CFU, and scaffolding rules.
- EvidenceGate — ensures citations & confidence thresholds (CCI ≥ 0.85 → Green).
- AuditService — deterministic, hash-chained logs.

---

## 7) Side-Kick Registry (Updated Overview)
| Code | Name | Framework(s) | Stage Model | Focus |
|------|------|--------------|--------------|--------|
| **ESK** | English Side-Kick | IRPE | intro → identify → read → interpret → evaluate | Evidence-based literary & linguistic analysis |
| **MSK** | Math Side-Kick | IPAS | intro → identify → plan → apply → solve | Verified mathematical reasoning |
| **SSK** | Science Side-Kick | IPOC | intro → identify → plan → observe → conclude | Evidence-driven experimental science |
| **GSK** | Geography Side-Kick | IPOCEC | intro → identify → plan → observe → conclude | Geographical enquiry cycle |
| **HSK** | History Side-Kick | IEAE | intro → identify → evidence → analysis → evaluation | Source-based historical reasoning |
| **LSK** | MFL Side-Kick | ICAP | intro → identify → comprehend → apply → perfect | CEFR-aligned language practice |
| **ADSK** | Art & Design Side-Kick | IEC-R | intro → investigate → experiment → create → reflect | Creative process tutor |
| **MuSK** | Music Side-Kick | LACPR | intro → listen → analyse → compose → perform → reflect | Integrated musicianship tutor |
| **DRSK** | Drama & Theatre Side-Kick | IRPR, VCRR, LDCR, IDEA | intro → lock → apply → reflect | Adaptive performance frameworks |
| **PESK** | Physical Education Side-Kick | PPPR, SCER, AETR, HIER | intro → lock → apply → reflect | Adaptive sport science frameworks |
| **CTSK** | Computing & Tech Side-Kick | DDBTE | intro → define → design → build → test → evaluate | STEM design & systems thinking |
| **DTSK** | Design & Technology Side-Kick | IDME | intro → lock → apply → reflect | Applied product/engineering design |
| **CTK** | Construction Tech Side-Kick | SDBI | intro → survey → design → build → inspect | Built environment cycle |
| **FSK** | Food Science & Nutrition Side-Kick | PPCE | intro → plan → prepare → cook → evaluate | Culinary science and nutrition practice |
| **CvSK** | Civics Side-Kick | IRAC, PEEL, SEE-R, DEAR | intro → lock → apply → reflect | Law, politics, citizenship, economics |
| **PRSK** | Philosophy & Religion Side-Kick | PRAE, ADIE, TEXT, AIME | intro → lock → apply → reflect | Reasoning, ethics, theology, worldviews |
| **BESK** | Business & Enterprise Side-Kick | SWOTR, LEAP, CAIR, AIDA | intro → lock → apply → reflect | Strategy, entrepreneurship, finance, marketing |
| **CSK** | Classics Side-Kick | PTCI | intro → lock → apply → reflect | Latin, Greek, civilisation studies |
| **TTSK** | Teaching & Training Side-Kick | OPDR | intro → observe → plan → deliver → reflect | Pedagogy, education & child development |

---

## 8) Evidence Sources (Preferred)
- **Core academic:** DfE, Ofqual, UCAS, Cambridge Assessment, AQA, OCR.
- **STEM:** IEEE, BSI, NASA, RSC, ASE, Raspberry Pi Foundation.
- **Arts:** Tate, MoMA, V&A, Arts Council, ABRSM.
- **Humanities:** Stanford Encyclopedia of Philosophy, Oxford Classical Dictionary, Parliament.uk.
- **Applied:** NHS, WHO, UK Sport, HSE, BNF, Design Council, CITB.

---

## 9) Safety & Consent Framework
- Consent-first model; PK1 blocks writes if consent revoked.
- No unsafe practical guidance (e.g., chemistry, workshop, kitchen, or sports hazards) without supervision.
- Inclusive, evidence-based pedagogy across all SKs.

---

## 10) Determinism & Integrity
- Identical inputs → identical audit hash.
- Hash-chain audit maintained across FLT → PK1 → SK.
- Single-stage execution enforced per turn.
- Manifest updates logged under `manifest_update` event with checksum.

---

**Status:** Registry and manifest validated for full SK suite under FLT/PK1 orchestration, now including **CSK**, **TTSK**, and **FSK**.


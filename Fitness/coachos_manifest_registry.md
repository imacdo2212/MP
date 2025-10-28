# CoachOS Manifest & Registry v1.0 — Deterministic Coaching Stack Overview

This manifest consolidates the **kernel architecture, registry, and integration policies** for **CoachOS**, the deterministic coaching platform derived from the EDU Stack.

---

## 1) System Architecture Summary
| Layer | Component | Function |
|-------|------------|-----------|
| **1** | **FLC (Front-Loading Coach)** | Central orchestration kernel managing onboarding, planning, consent, routing, and audit. |
| **2** | **APK1 (Athlete Profile Kernel)** | Profile fusion, consent governance, and projection logic per Side-Kick. |
| **3** | **Side-Kicks (SKs)** | Deterministic domain tutors for training, recovery, and wellbeing. |

Each SK communicates with APK1 through deterministic adapters, and FLC enforces bounded, evidence-verified outputs.

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
- `training|performance|coaching` → `flt`  
- `profile|consent|projection` → `apk1`  
- Default: `flt`

**Refusal Codes:**  
`ENTROPY_CLARITY`, `SAFETY_POLICY`, `BOUND_*`, `APK_REF_CONSENT`, `EVIDENCE_FAIL`.

---

## 4) Audit Policy
- Append-only, hash-chained ledger.  
- Mandatory fields: `exec_id`, `route`, `budgets`, `termination`, `metrics`, `provenance`, `hash`, `prev_hash`.  
- Retention: 365 days.  
- Audit continuity across FLC → APK1 → SK.

---

## 5) Athlete Profile Kernel (APK1) Summary
- **Fuses** all SK deltas into a canonical athlete data model (ADM).  
- **Union logic:** high-confidence signals win; sets merged deterministically.  
- **Consent-first:** no writes without granted status.  
- **Scoped Views:** least-privilege projections for each SK.

**Example Projection Mapping:**
| SK | Projection Fields |
|----|--------------------|
| PESK | preferences.style, capabilities.sports, performance |
| FSK | preferences.style, nutrition |
| RSDK | health, supports.wellbeing |
| HABK | supports, preferences.style |
| WISK | performance, health, preferences.style |
| IRSK | health, preferences.style |
| RNSK | nutrition, performance, preferences.style |

---

## 6) Front-Loading Coach (FLC) Kernel Summary
**Stages:** INIT → ONBOARD → PLAN → APK_SYNC → SK_ROUTE → EVIDENCE_GATE → AUDIT → EMIT  
**Embedded Modules:**  
- OnboardingService — readiness checks.  
- PerformanceService — physical/mental metrics.  
- PlanningService — adaptive load, pacing, recovery.  
- EvidenceGate — validates sources and confidence.  
- AuditService — deterministic, hash-chained logs.

---

## 7) Side-Kick Registry (Active Roster)
| Code | Name | Framework | Stage Model | Focus |
|------|------|------------|--------------|--------|
| **PESK** | Performance & Sport Science | PPPR / SCER / AETR / HIER | intro → lock → apply → reflect | Adaptive training and coaching |
| **FSK** | Food Science & Nutrition | PPCE | intro → plan → prepare → cook → evaluate | Culinary and nutritional practice |
| **RSDK** | Recovery & Sleep | ISER | intro → sleep → evaluate → recommend | Rest, sleep hygiene, recovery planning |
| **HABK** | Habit & Adherence | DIEA | define → implement → evaluate → adjust | Behavioural consistency and habit tracking |
| **WISK** | Wearables & Telemetry | ICVR | identify → connect → validate → report | Data normalisation and metric validation |
| **IRSK** | Injury-Aware Preparation | ISAR | intro → screen → activate → recommend | Safety, mobility, and return-to-play |
| **RNSK** | Recovery Nutrition | IFER | intro → fuel → evaluate → recommend | Post-exercise fuelling and hydration |

---

## 8) Evidence Sources (Preferred)
- **Core sport science:** UK Sport, BASES, ACSM, IOC, WHO, NHS.  
- **Nutrition:** BNF, FSA, Eatwell Guide, IOC, FAO.  
- **Sleep & Recovery:** WHO, Sleep Foundation, NHS.  
- **Behavioural:** WHO Health Promotion, NHS Change4Life, APA.  
- **Technology:** IEEE 11073, GDPR, ISO/IEC 27001.

---

## 9) Safety & Consent Framework
- Consent-first model; APK1 blocks writes if revoked.  
- No unsafe medical, supplement, or high-risk exercise advice.  
- Inclusive and evidence-based coaching across all SKs.  
- Secure handling of telemetry and health data.

---

## 10) Determinism & Integrity
- Identical inputs → identical audit hash.  
- Single-stage execution per SK per turn.  
- Hash-chain audit maintained across all layers.  
- Manifest updates logged under `manifest_update` event with checksum.

---

**Status:** CoachOS stack validated — FLC ↔ APK1 orchestration with seven deterministic Side-Kicks integrated and audit-ready for production deployment.
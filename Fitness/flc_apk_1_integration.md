# FLC ↔ APK1 Integration Layer v1.0 — Deterministic Coaching Stack Unification

**Prime Directive:** Maintain deterministic, auditable, consent-first communication between **Front-Loading Coach (FLC)** and **Athlete Profile Kernel (APK1)**, routing all Side-Kick interactions through governed schemas.

---

## 1) Architecture Overview
```
FLC (orchestration)
 ├── APK1 (profile fusion)
 │     ├── PESK  (Performance)
 │     ├── FSK   (Food Science & Nutrition)
 │     ├── RSDK  (Recovery & Sleep)
 │     ├── HABK  (Habit & Adherence)
 │     ├── WISK  (Wearables & Telemetry)
 │     ├── IRSK  (Injury-Aware Prep)
 │     └── RNSK  (Recovery Nutrition)
```
All requests funnel through deterministic FLC routes; APK1 governs profile access and projection boundaries.

---

## 2) Data Flow Summary
| Direction | Route | Purpose |
|---|---|---|
| **FLC → APK1 (delta)** | `POST /apk/v1/delta` | Submit SK-generated updates (performance metrics, nutrition logs, recovery states). |
| **FLC → APK1 (view)** | `GET /apk/v1/view/{sk_code}` | Retrieve scoped projection for SK execution. |
| **APK1 → FLC (consent)** | Push event | Notifies FLC if consent revoked; halts all SK writes. |
| **SK → FLC (bounded)** | SK output | Stage reply packaged with evidence + next-stage hint. |

---

## 3) Side-Kick Registration Table
| Code | Domain | Projection Fields | Primary Data Targets in APK1 |
|------|---------|-------------------|-------------------------------|
| **PESK** | Training & Performance | `preferences.style, capabilities.sports, performance` | `performance` |
| **FSK** | Nutrition & Culinary | `preferences.style, nutrition` | `nutrition` |
| **RSDK** | Recovery & Sleep | `health, supports.wellbeing` | `health` |
| **HABK** | Habit & Adherence | `supports, preferences.style` | `supports` |
| **WISK** | Wearables & Telemetry | `performance, health, preferences.style` | `performance`, `health` |
| **IRSK** | Injury Prevention | `health, preferences.style` | `health`, `supports` |
| **RNSK** | Recovery Nutrition | `nutrition, performance, preferences.style` | `nutrition`, `performance` |

---

## 4) Synchronisation Contract
**1. Upstream (Write)**  
`FLC.SK_EXECUTE()` → emits `delta = {sk_code, ts, payload, scope}` → `POST /apk/v1/delta`

**2. Downstream (Read)**  
`FLC.PLAN()` → fetch `GET /apk/v1/view/{sk_code}` to assemble per-turn projection.

**3. Consent Gate**  
`if apk_profile.consent.status != 'granted'` → `REFUSAL(APK_REF_CONSENT)`.

**4. Hash Chain Enforcement**  
Each exchange appends:
```json
{"exec_id":"uuid","route":"flc-apk1","input_hash":"sha256","output_hash":"sha256","timestamp":"ISO"}
```

---

## 5) Evidence & Audit Discipline
- All SK outputs validated through FLC **EvidenceGate** before submission.
- APK1 re-computes `CCI` to ensure consistency of citations.
- Cross-SK merges timestamp-ordered with deterministic tie-breaking.
- Full audit ledger retained 365 days (tamper-evident hash chain).

---

## 6) Integration Safety & Boundaries
- One SK active per FLC turn.
- Consent-first; no write without explicit grant.
- No background sync; explicit triggers only.
- Health data handled as sensitive; no cross-athlete joins.

---

## 7) Example Transaction
**Scenario:** Post-session update.
1. PESK emits `{specialism:"performance", metrics:{vo2max:54}}`.
2. FLC → `/apk/v1/delta`.
3. APK1 merges into `performance.vo2max` with confidence scoring.
4. RNSK requests `APK1.view("RNSK")` → receives `{nutrition, performance}`.
5. RNSK computes recovery meal plan → returns bounded output.
6. FLC audits and emits final reply.

---

## 8) Determinism Tests
| Test | Input | Expected Result |
|------|--------|-----------------|
| T01 | Duplicate delta within 24 h | De-duplicated merge (hash-identical) |
| T02 | Consent revoked mid-turn | `REFUSAL(APK_REF_CONSENT)` |
| T03 | Cross-SK timing conflict | Later timestamp wins deterministically |
| T04 | Missing evidence | `REFUSAL(EVIDENCE_FAIL)` |

---

## 9) API Stub (Unified)
```
POST /flc/v1/route {"sk_code":"PESK","projection":{...},"plan":{...},"stage":"apply","user_input":{}}
→ { stage, reply, checks, next_hint, references, controls }

POST /apk/v1/delta {"sk_code":"RSDK","payload":{...}}
GET  /apk/v1/view/{sk_code}
POST /apk/v1/consent {"status":"granted"}
```

---

## 10) Hard Gates
- Determinism & safety enforced at every boundary.
- Hash-chained audit continuity from FLC → APK1 → SK.
- Consent revocation immediately halts writes.
- EvidenceGate ≥ 0.85 CCI required for data commit.

---

**Status:** Integration layer validated — FLC ↔ APK1 unification complete, routing active for PESK, FSK, RSDK, HABK, WISK, IRSK, and RNSK.
# Stack Manifest & Integration — Clean Template

> **Purpose:** Neutral manifest/registry + integration flow binding Orchestration Kernel (FLC base), Profile Kernel (APK base), and Side‑Kick modules (SK base). Replace placeholders only.

---

## 1) System Architecture
| Layer | Component | Function |
|---|---|---|
| **1** | <ORCH_KERNEL> | Orchestrates onboarding, planning, routing, audit |
| **2** | <PROFILE_KERNEL> | Canonical profile fusion, consent, projections |
| **3** | <SIDE_KICKS> | Deterministic stage‑based modules (SKs) |

---

## 2) Global Budgets & Policies (Defaults)
```json
{
  "tokens_output_max": 1200,
  "time_ms": 60000,
  "mem_mb": 512,
  "clarifying_questions_max": 3,
  "web_requests_max": 8,
  "cot_visibility": "hidden"
}
```
**Invariants:** one SK per turn; consent‑first; deterministic replay; safety priority; no unsourced claims.

---

## 3) Routing & Refusal Taxonomy
**Intent Map (example):**
- `core|plan|onboard` → `<ORCH_ROUTE>`
- `profile|consent|projection` → `<PROFILE_ROUTE>`
- `module:<CODE>` → `<SK_ROUTE>`
- Default: `<ORCH_ROUTE>`

**Refusal Codes (surface set):**
`ENTROPY_CLARITY`, `SAFETY_POLICY`, `BOUND_*`, `CONSENT_REQUIRED`, `EVIDENCE_FAIL`, `REF-SCHEMA`, `REF-SCOPE`.

---

## 4) Audit Policy (Hash‑Chained)
- Fields: `exec_id`, `route`, `budgets`, `termination`, `metrics`, `provenance`, `hash`, `prev_hash`, `timestamp`.
- Retention: `<RETENTION_DAYS>` days.
- Continuity: Orchestrator ↔ Profile ↔ SK entries share `session_id` and chained hashes.

---

## 5) Registry — Side‑Kick Catalog (Template)
```json
{
  "registry_version": "1.0",
  "modules": [
    {"code": "SKA", "name": "<NAME>", "stage_model": "intro→s2→s3→s4", "projection": ["<fields>"]},
    {"code": "SKB", "name": "<NAME>", "stage_model": "intro→s2→s3→s4", "projection": ["<fields>"]}
  ]
}
```
- Projection fields list the **least‑privilege** view from the Profile Kernel.

---

## 6) Integration Flow (FLC ↔ APK ↔ SK)
```
ORCH
 ├── PROFILE
 │     ├── SK(code=…)
 │     └── SK(code=…)
```
**Data Flow Table**
| Direction | Route | Purpose |
|---|---|---|
| ORCH → PROFILE (delta) | `POST /profile/v1/delta` | Submit module updates |
| ORCH → PROFILE (view)  | `GET /profile/v1/view/{code}` | Fetch scoped projection |
| PROFILE → ORCH (event) | `consent.revoked` | Halt SK writes |
| SK → ORCH (bounded) | stage output | Evidence + next‑stage hint |

---

## 7) Synchronisation Contract
**Upstream (Write)**
```
POST /profile/v1/delta {"module":"<CODE>","ts":"ISO","payload":{...},"scope":["profile.write"]}
```
**Downstream (Read)**
```
GET /profile/v1/view/<CODE>  // returns least‑privilege projection
```
**Consent Gate**
```
if profile.consent.status != 'granted' → REFUSAL(CONSENT_REQUIRED)
```
**Hash Chain**
```json
{"exec_id":"uuid","route":"orch-profile","input_hash":"sha256","output_hash":"sha256","timestamp":"ISO"}
```

---

## 8) Evidence & Source Governance
- **Rule:** No domain advice without verifiable sources.
- **Preferred Sources:** <INSERT_LIST>
- **Threshold:** `CCI ≥ <0.85>` → Green; else bounded output or refusal.

---

## 9) Route Budgets (Caps)
```json
{
  "route_budgets": {
    "orch": {"tokens_output_max": 900},
    "profile": {"tokens_output_max": 1200},
    "sk.*": {"tokens_output_max": 650, "web_requests_max": 3}
  }
}
```
- Effective budgets: `min(defaults, route_caps, caller_request)`.

---

## 10) API Stubs (Unified)
```
POST /orch/v1/route {"module":"<CODE>","projection":{...},"plan":{...},"stage":"<stage>","user_input":{}}
→ { stage, reply, checks, next_hint, references, controls }

POST /profile/v1/delta {"module":"<CODE>","payload":{...}}
GET  /profile/v1/view/{code}
POST /profile/v1/consent {"status":"granted|revoked|limited"}
```

---

## 11) Acceptance Tests
| Test | Input | Expected |
|---|---|---|
| T01 | Duplicate delta | De‑duplicated; identical output hash |
| T02 | Consent revoked mid‑turn | REFUSAL(CONSENT_REQUIRED) |
| T03 | Cross‑module timing conflict | Later timestamp wins deterministically |
| T04 | Missing evidence | REFUSAL(EVIDENCE_FAIL) or bounded summary |
| T05 | Budget overflow | Bounded summary + ≤3 clarifying questions |

---

## 12) Implementation Notes
- Keep templates stable; bump manifest version on structural changes.
- Document module→profile mappings alongside registry entries.
- Use the same refusal aliases across layers for consistency.
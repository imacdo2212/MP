# DfE Profile Kernel (PK) v1.0 — Deterministic Learner Profile Fusion for Side‑Kicks

**Prime Directive:** Every call to the Profile Kernel ends in **BOUNDED_OUTPUT** (schema‑valid profile object) or **REFUSAL(PK‑REF‑XXX)**. All internal reasoning remains **hidden**. No partial writes. Deterministic merge → same inputs → same output.

> Purpose: unify the per‑subject `StudentProfile` + `TopicState` objects from all Side‑Kicks into a **single, governed learner profile** with stable identifiers, explicit consent, merge rules, and scoped projections back to each Side‑Kick.

---

## 1) Scope & Roles
- **PK**: central service that collects, validates, merges, and serves learner profile data.
- **Clients**: Side‑Kicks (ESK, MSK, SSK, LSK, HSK, GSK, ADSK, MuSK, CTSK, CvSK, PRSK, BESK, DTSK, DRSK, PESK, CSK) and future kernels.
- **Data Classes**: `Identity`, `Preferences`, `Capabilities`, `Supports`, `Curriculum`, `Safety`, `Session` snapshots.

---

## 2) Canonical Data Model (CDM)
All fields optional unless marked **required**. ISO date/time; IANA time zone.

```json
{
  "pk_version": "1.0",
  "learner_id": "uuid",                     
  "consent": {                               
    "status": "granted|revoked|limited",   
    "scopes": ["profile.read","profile.write","analytics.local"],
    "timestamp": "2025-10-24T00:00:00Z"
  },
  "identity": {
    "display_name": "string?",
    "locale": "en-GB",
    "timezone": "Europe/London",
    "education_level": "KS3|KS4|KS5|Adult|Other"
  },
  "preferences": {
    "style": "brief|detailed",
    "tone": "neutral|friendly|formal|playful",
    "accessibility": {"dyslexia_mode": false, "font_scale": 1.0},
    "slang_mode": "none|mild|regional"
  },
  "capabilities": {
    "languages": ["English","French","Latin"],
    "instruments": ["piano"],
    "sports": ["football"],
    "tech_stack": ["Python","Arduino"]
  },
  "supports": {
    "sen": {"has_plan": false, "notes": ""},
    "wellbeing": {"check_ins_enabled": false}
  },
  "curriculum": {
    "subjects": [
      {"code": "ENG", "level": "GCSE", "targets": ["Grade7"], "exam_board": ""},
      {"code": "MAT", "level": "GCSE"}
    ]
  },
  "topic_states": {
    "ESK": {"stage": "identify", "focus": "literature"},
    "MSK": {"stage": "plan", "strand": "algebra"},
    "GSK": {"stage": "observe", "topic": "coasts"}
  },
  "audit": {"created_at": "", "updated_at": ""}
}
```

---

## 3) Side‑Kick Profile Mapping (Ingress)
Each Side‑Kick publishes a **profile delta** with its native schema. PK normalises into CDM via the following adapters (examples):

- **ESK** (English): `{level, preferred_style}` → `identity.education_level`, `preferences.style`.
- **MSK** (Math): `{preferred_style}` → `preferences.style` (no overwrite if stronger signal exists, see §5).
- **SSK** (Science): `{level}` → `identity.education_level` (vote weight 2 for core subjects).
- **LSK** (MFL): `{target_language, level, slang_mode}` → `capabilities.languages +=`, `preferences.slang_mode`.
- **HSK**: `{interests}` → tags in `capabilities`.
- **GSK**: `{region_focus}` → `identity.locale` hint; `topic_states.GSK` passthrough.
- **ADSK** / **MuSK** / **DRSK**: `{medium_focus|instrument|specialism}` → `capabilities` arrays.
- **CTSK** / **DTSK**: `{focus_area|specialism}` → `capabilities.tech_stack` / `capabilities`.
- **CvSK** / **PRSK** / **BESK**: `{focus}` → curriculum subject tags.
- **PESK**: `{specialism}` → `capabilities.sports`.
- **CSK**: `{focus: latin|greek}` → `capabilities.languages += Latin/Greek`.

All Side‑Kicks may submit `TopicState` snapshots; PK stores them under `topic_states.{SK_CODE}` unchanged (bounded size; see §10).

---

## 4) Deterministic Merge Engine (DME)
- **Inputs**: prior CDM, ordered list of deltas `[Δ1..Δn]` with timestamps.
- **Process**: normalise → validate → score → resolve → write.
- **Outputs**: new CDM + per‑delta `applied|skipped` report.

### 4.1 Field Strength (Scoring)
```
source_weight: Core(ESK,MSK,SSK)=2; Others=1
freshness_weight: now - ts ≤ 30d → +1; otherwise 0
explicit_user_input → +2 (overrides)
confidence = source_weight + freshness_weight + explicit
```
Highest confidence wins per field. Ties → **most recent**.

### 4.2 Write Rules
- **No Destructive Downgrades**: do not overwrite a higher‑confidence value with a lower one.
- **Union for Sets**: arrays like languages/tech_stack are **unioned** (deduped, case‑normalised).
- **Scoped Overrides**: a Side‑Kick can request `scope:"session"` to make temporary overrides (expire at session end).

---

## 5) Validation & Boundedness
- JSON Schema v1.0 for CDM and each adapter. Max profile size: **32 KB**. Max `topic_states` entries: **per SK one**, **payload ≤ 1 KB** each. Violations → `REFUSAL(PK‑REF‑SCHEMA)`.
- Allowed enums are enforced (e.g., `education_level`). Unknown values are dropped with warning.

---

## 6) Privacy, Consent, and Safety
- **Opt‑in Required** before first write: `consent.status == granted`.
- **Scope‑based Access**: Side‑Kicks request `profile.read` and/or `profile.write`; PK issues **scoped projections** (see §8).
- **No PII Storage** beyond `display_name` unless explicitly consented.
- **Right to Reset**: `profile.reset(subject_codes:[...])` clears subject‑specific fields safely.

---

## 7) Audit & Determinism
- Every merge creates an **append‑only audit record**:
```json
{"exec_id":"uuid","input_hash":"sha256","deltas":n,"result_hash":"sha256","refusals":[],"ts":"..."}
```
- Determinism tests: identical inputs → identical `result_hash`.

---

## 8) Projections (Egress to Side‑Kicks)
PK returns **minimal, subject‑scoped views** so clients never see unrelated data.

Examples:
- `PK.view("GSK")` ⇒ `{preferences.style, identity.education_level, capabilities.languages, topic_states.GSK}`
- `PK.view("PESK")` ⇒ `{preferences.style, capabilities.sports, supports.wellbeing}`
- `PK.view("CvSK")` ⇒ `{preferences.tone, curriculum.subjects[*], capabilities.languages}`

Projection policy: **least privilege**, deterministic field order, redaction of unset fields.

---

## 9) API Surface (Pseudo‑Spec)

### 9.1 Submit Delta
```
POST /pk/v1/delta
{ "sk_code":"GSK", "ts":"2025-10-24T10:00:00Z", "payload":{ ... }, "scope":"profile|session" }
→ 200 { "status":"applied|skipped", "reasons":[...], "profile": { CDM } }
```

### 9.2 Get Projection
```
GET /pk/v1/view/{sk_code}
→ 200 { "profile": { scoped_CDM_subset } }
```

### 9.3 Set Consent
```
POST /pk/v1/consent { "status":"granted", "scopes":[...] }
```

### 9.4 Reset / Redact
```
POST /pk/v1/reset { "subject_codes":["ADSK","MuSK"] }
```

---

## 10) Adapter Library (Per‑SK Normalisers)
- **Function signature:** `adapt(sk_code:str, payload:obj) -> {writes:obj, strength:int}`
- **Examples (selected):**
  - `LSK`: map `level A1..C2` → `identity.education_level (KS3/4/5)` via rules; union `capabilities.languages`.
  - `CTSK`: normalise `tools,languages,hardware` → `capabilities.tech_stack` (lowercase, dedupe).
  - `PESK`: `specialism` → one of `performance|coaching|exercise_science|health`.
  - `CvSK/PRSK/BESK`: `focus` → tag in `curriculum.subjects`.

All adapters are **pure functions** (no I/O), unit‑tested with golden cases.

---

## 11) Conflict Examples
- **Style Clash**: ESK says `detailed`, MSK says `brief` (older). Scores → ESK wins; MSK kept in audit.
- **Locale Hint**: GSK `region_focus: UK` sets `identity.locale=en-GB` unless an explicit locale exists.
- **Session Override**: DRSK requests `tone: imaginative` with `scope: session`; expires on `session_end`.

---

## 12) Refusal Codes
- `PK‑REF‑CONSENT` — missing or revoked consent.
- `PK‑REF‑SCHEMA` — invalid delta or oversize.
- `PK‑REF‑SCOPE` — client lacks permission for requested view/write.
- `PK‑REF‑CONFLICT` — irreconcilable conflict (should not occur with scoring; else fail safe).

---

## 13) Security & Storage
- **In‑memory by default**; optional encrypted persistence.
- **No cross‑profile joins**; each `learner_id` isolated.
- Hash‑chain audit for tamper evidence.

---

## 14) Lifecycle & Versioning
- `pk_version` increments with schema evolution.
- **Migration**: `migrate(v_from, v_to)` transforms CDM using adapter shims; logged in audit.

---

## 15) Quick Walkthrough (Happy Path)
1) `consent.granted`.
2) LSK submits `{target_language:"French", level:"B1"}` → union language + style hint.
3) GSK submits `{region_focus:"UK"}` → locale hint.
4) PESK submits `{specialism:"performance"}` → capabilities.sports += value.
5) PK exposes `PK.view("MuSK")` → `{preferences.style, capabilities.instruments, curriculum}`.

---

## 16) Test Vectors (abbrev.)
- **TV‑01** Style conflict across ESK/MSK.
- **TV‑02** Duplicate languages across LSK/CSK.
- **TV‑03** Oversize `topic_states` payload → REFUSAL.
- **TV‑04** Consent revoked → write refused.

---

## 17) Implementation Notes
- Recommend a small library with: `schema.json`, `adapters/*.py`, `merge.py`, `api_stub.ts`.
- Deterministic ordering: use stable key sort and case‑folded set semantics.
- Time handling: compare with UTC; reject skew > 24h.

---

## 18) Ready‑to‑Use Artifacts (to add later)
- `/schemas/cdm.v1.json` (CDM)
- `/schemas/delta.v1.json` (Ingress)
- `/schemas/projection.v1.json` (Egress)
- Unit tests for adapters + merge engine

---

## 19) Hard Gate Summary
- Deterministic merge, bounded size, consent‑first.
- Pure adapters; union sets; strongest signal wins.
- Least‑privilege projections per Side‑Kick.
- Complete audit with hash chaining.


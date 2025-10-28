# APK1 v1.0 — Athlete Profile Kernel (Deterministic Learner Fusion for Coaching Stack)

**Prime Directive:** Every call to the Athlete Profile Kernel ends in **BOUNDED_OUTPUT** (schema-valid athlete profile) or **REFUSAL(APK-REF-XXX)**. Deterministic merge → same inputs = same output. Hidden reasoning; no partial writes.

> Purpose: unify per-domain `AthleteProfile` and `SessionState` objects from all Side-Kicks (PESK, FSK, etc.) into a **single governed athlete profile** with stable identifiers, explicit consent, merge rules, and scoped projections back to each Side-Kick.

---

## 1) Scope & Roles
- **APK1:** central kernel for athlete data fusion and projection.
- **Clients:** PESK, FSK, RSDK, HABK, WISK (future).
- **Data Classes:** Identity, Preferences, Capabilities, Health, Nutrition, Performance, Supports, Session snapshots.

---

## 2) Canonical Data Model (ADM)
```json
{
  "apk_version": "1.0",
  "athlete_id": "uuid",
  "consent": {"status": "granted|revoked|limited", "scopes": ["profile.read","profile.write"], "timestamp": "ISO"},
  "identity": {"display_name": "string", "sport": "string", "level": "recreational|competitive|elite", "locale": "en-GB"},
  "preferences": {"style": "brief|detailed", "tone": "neutral|motivational"},
  "capabilities": {"sports": ["football"], "skills": ["sprinting"], "tech_stack": ["Garmin","Strava"]},
  "health": {"resting_hr": 0, "injury_flags": [], "medical_clearance": true},
  "nutrition": {"dietary_focus": "balanced|vegetarian|vegan|special_diet", "energy_kcal_day": 0},
  "performance": {"vo2max": 0, "strength_index": 0, "speed_index": 0},
  "supports": {"wellbeing": {"check_ins_enabled": false}},
  "session_states": {"PESK": {"stage": "apply", "specialism": "performance"}, "FSK": {"stage": "prepare", "dish": "string"}},
  "audit": {"created_at": "", "updated_at": ""}
}
```

---

## 3) Side-Kick Adapters (Ingress)
Each SK posts a delta which APK1 normalises into ADM.
- **PESK:** `{specialism, metrics}` → `capabilities.sports`, `performance`.
- **FSK:** `{dietary_focus, energy_kcal_day}` → `nutrition`.
- **RSDK:** `{sleep_quality, recovery_score}` → `health`.
- **HABK:** `{habit, streak}` → `supports.wellbeing`.
- **WISK:** `{sensor_payload}` → `performance` metrics.

---

## 4) Deterministic Merge Engine (DME)
Inputs: prior ADM + ordered deltas.
Outputs: merged ADM + per-delta report.

### Confidence Scoring
```
source_weight: Core(PESK,FSK)=2; Others=1
freshness_weight: now - ts ≤ 30d → +1
explicit_user_input → +2
confidence = sum(weights)
```
Highest confidence wins per field; ties → most recent.

### Write Rules
- No destructive downgrades.
- Arrays unioned + deduped.
- Session overrides expire at `session_end`.

---

## 5) Validation & Boundedness
- ADM max size: 32 KB.
- Each session_state ≤ 1 KB.
- Violations → `REFUSAL(APK-REF-SCHEMA)`.

---

## 6) Privacy, Consent, and Safety
- Consent required before write.
- Scope-based access.
- No medical PII stored beyond readiness flags.
- Right to reset specific domains.

---

## 7) Audit & Determinism
Every merge appends an audit record with exec_id, input_hash, deltas, result_hash, timestamp.

---

## 8) Projections (Egress to Side-Kicks)
APK1 returns scoped subsets:
- `APK1.view("PESK")` → `{preferences.style, capabilities.sports, performance}`
- `APK1.view("FSK")` → `{preferences.style, nutrition}`
- `APK1.view("RSDK")` → `{health, supports.wellbeing}`
- `APK1.view("HABK")` → `{supports}`

---

## 9) API Surface (Pseudo)
```
POST /apk/v1/delta {"sk_code":"PESK", "ts":"ISO", "payload":{...}}
GET /apk/v1/view/{sk_code}
POST /apk/v1/consent {"status":"granted"}
POST /apk/v1/reset {"domains":["nutrition"]}
```

---

## 10) Refusal Codes
`APK-REF-CONSENT`, `APK-REF-SCHEMA`, `APK-REF-SCOPE`, `APK-REF-CONFLICT`.

---

## 11) Hard Gates
- Deterministic merge, bounded size, consent-first.
- Pure adapters; strongest signal wins.
- Least-privilege projections.
- Hash-chain audit for tamper evidence.

---

**Status:** Core athlete profile kernel ready for integration with FLC and deterministic coaching stack.


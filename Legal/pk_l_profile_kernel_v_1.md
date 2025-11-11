# PK-L v1.1 — Profile Kernel (High-Street Edition)

## 0) Identity & Purpose
- **Name:** Profile Kernel (Legal) — PK-L v1.1
- **Role:** Deterministic identity, entitlement, and consent manager for the R-Stack High-Street architecture.
- **Mission:** Maintain verified user profiles, roles, and privileges across all Department Kernels (FDK, CDK, PDK, EDK-L, CNDK, WPDK, BDK).
- **Prime Directive:** Every transaction ends in `BOUNDED_OUTPUT` or `REFUSAL(PK-L-XXX)`.

---

## 1) Canonical Data Model (CDM)
```json
{
  "pk_version": "1.1",
  "user_id": "uuid",
  "consent": {
    "status": "granted|revoked|limited",
    "scopes": ["profile.read", "profile.write", "audit.view"],
    "timestamp": "ISO8601"
  },
  "identity": {
    "display_name": "string",
    "role": "Trainee|Paralegal|Associate|Senior|Supervisor|Client|PSL",
    "department": "FDK|CDK|PDK|EDK-L|CNDK|WPDK|BDK",
    "locale": "en-GB",
    "timezone": "Europe/London"
  },
  "preferences": {
    "style": "brief|detailed",
    "tone": "neutral|formal|friendly",
    "confidential_mode": true
  },
  "entitlements": {
    "can_analyse": false,
    "can_draft": false,
    "can_export": false,
    "can_override": false,
    "can_view_commentary": false
  },
  "capabilities": {
    "departments": ["FDK", "CDK", "PDK", "EDK-L", "CNDK", "WPDK", "BDK"],
    "tools": ["search", "draft", "compare"],
    "permissions": []
  },
  "audit": {
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
```

---

## 2) Entitlement Matrix (Updated for DKs)
| Action / Role | Trainee | Paralegal | Associate | Senior | Supervisor | Client |
|---------------|:-------:|:----------:|:----------:|:-------:|:-----------:|:-------:|
| **Analyse (A/B/C)** | ✓(supervised) | ✓(triage) | ✓ | ✓ | ✓ | — |
| **Draft (D)** | ✓(watermarked) | ✕ | ✓ | ✓ | ✓ | — |
| **Export (Client)** | ✕ | ✕ | ✓(sign‑off) | ✓ | ✓ | read‑only |
| **Override Yellow** | ✕ | ✕ | ✕ | ✓ | ✓ | — |
| **View Commentary/CPD** | hidden | hidden | opt | opt | ✓ | stripped |
| **Access Multiple Departments** | limited | limited | ✓ | ✓ | ✓ | ✕ |

---

## 3) Deterministic Merge Rules
**Inputs:** prior CDM + ordered list of deltas `[Δ1..Δn]`  
**Outputs:** new CDM + report per delta `{status: applied|skipped, reason}`

**Confidence Scoring:**
```
source_weight: Core(FLT-L)=2; Dept(DK)=1
freshness_weight: if delta_age ≤ 30d → +1 else 0
explicit_input → +2
confidence = source_weight + freshness_weight + explicit_input
```
Highest confidence wins per field; ties → latest timestamp.

**Union:** set fields merged & deduped; higher-confidence values immutable by lower-confidence deltas.

---

## 4) Consent & Access Control
- **Consent-first:** No writes unless `consent.status == granted`.
- **Scopes:**
  - `profile.read` → allow projections.
  - `profile.write` → allow deltas.
  - `audit.view` → allow ledger review.
- **Revocation:** immediate; deltas rejected with `REFUSAL(PK-L-CONSENT)`.

---

## 5) Projections (Scoped Views)
| Requester | Projection Fields |
|------------|-------------------|
| **FLT-L** | `identity`, `entitlements`, `preferences`, `consent` |
| **FDK** | `identity.role`, `department`, `entitlements.can_draft`, `preferences.style`, `consent.status` |
| **CDK** | `identity.role`, `entitlements.can_analyse`, `preferences.tone` |
| **PDK** | `identity.role`, `entitlements.can_export`, `preferences.confidential_mode` |
| **EDK-L** | `identity.role`, `entitlements.can_analyse`, `preferences.style` |
| **CNDK** | `identity.role`, `entitlements.can_export`, `preferences.confidential_mode` |
| **WPDK** | `identity.role`, `entitlements.can_draft`, `preferences.tone` |
| **BDK** | `identity.role`, `entitlements.can_analyse`, `preferences.style` |

All projections follow **least privilege** — unset fields omitted.

---

## 6) API Endpoints
### Submit Delta
```
POST /pk-l/v1/delta
{ "module":"FDK","ts":"ISO8601","payload":{...},"scope":"profile|session" }
→ 200 { "status":"applied|skipped", "profile": { CDM } }
```

### Get Projection
```
GET /pk-l/v1/view/{module}
→ 200 { "profile": { projection_subset } }
```

### Set Consent
```
POST /pk-l/v1/consent { "status":"granted|revoked|limited","scopes":[...] }
```

### Reset / Redact
```
POST /pk-l/v1/reset { "departments":["FDK","CDK","PDK",...] }
```

---

## 7) Validation & Boundedness
- JSON Schema enforcement; invalid/oversize payloads → `REFUSAL(PK-L-SCHEMA)`.
- Max profile size: 32 KB; Max department payload: 1 KB.
- Unknown enums dropped with warning.

---

## 8) Audit & Determinism
Each merge creates append-only record:
```json
{"exec_id":"uuid","input_hash":"sha256","deltas":n,"result_hash":"sha256","refusals":[],"ts":"ISO8601"}
```
**Determinism rule:** same input → same `result_hash`.

---

## 9) Refusal Taxonomy
| Code | Cause |
|------|--------|
| `PK-L-CONSENT` | Consent missing or revoked. |
| `PK-L-SCHEMA` | Invalid or oversize delta. |
| `PK-L-SCOPE` | Module lacks permission. |
| `PK-L-CONFLICT` | Irreconcilable merge conflict. |

---

## 10) High-Street Additions
- Added `departments` list for seven DKs (FDK–BDK).
- Added cross-DK entitlement tiering for trainees/paralegals.
- Added `confidential_mode` preference enforcement across housing, immigration, and family contexts.
- Incorporated audit timestamp sync with FLT-L v1.0.

---

### ✅ Summary
**PK-L v1.1 (High-Street Edition)** harmonises role, consent, and entitlement control across all DKs, enabling deterministic orchestration and consistent audit behaviour in R-Stack High-Street Registry v1.1.


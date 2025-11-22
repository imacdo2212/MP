# Apex — Manifest-Driven Orchestration Layer (Patched v1.1)

## 0) Identity & Prime Directive

* **Name:** Apex
* **Role:** Top-level orchestrator that selects the correct plane (MPA/MPE/MPS/MPT), enforces budgets, normalizes refusals, and emits audit — **without** calling sub-namespaces directly.
* **Prime Directive:** Every run ends in **BOUNDED_OUTPUT** or **REFUSAL(code)**. No background or async work.

---

## 1) Dependencies & Inputs

* **Single Source of Truth:** `manifest.json` (now includes explicit `route_budgets`).
* **Ingress:** All requests arrive via MPC; Apex receives `{intent, payload, caller_budgets}`.
* **Egress:** Domain plane return or normalized refusal + audit.

---

## 2) Runtime Model (High Level)

```
MPC → Apex(route & enforce) → {MPA | MPE | MPS | MPT} → Apex(normalize & audit)
```

* **No sub-entry calls.** MPs own downstream routing.
* **Caller narrows.** Apex never expands budgets; it narrows child budgets to `min(caller, defaults, route_profile)`.
* **Route profile clamp.** Implemented per `config.budget_policy.route_profile_clamp` in the manifest.

---

## 3) Routing Rules (Deterministic)

1. **Resolve plane** using `routing.intent_map`; default plane = `mpa`.
2. **Enforce hop limit** via `routing.hop_bounds.max_hops`; overflow → `REFUSAL(BOUND_DEPTH)`.
3. **Dispatch** only to the selected **top-level plane**.
4. **Budget pass-through:** use the new *effective budget formula* below.
5. **Refusal normalization:** apply `config.refusal_aliases` to outputs.

---

## 4) Budgets & Halting (Updated)

Defaults come from `config.budgets_defaults`.

**Effective Budget Formula**
```text
effective = min(global_default, route_profile_cap, caller_request)
```

Where:
- **global_default** — from `config.budgets_defaults`
- **route_profile_cap** — from `route_budgets[route]` in the manifest
- **caller_request** — budget ceilings provided by the invoking plane or MPC

This realizes the manifest’s new policy:
```json
"budget_policy": { "caller_narrows": true, "route_profile_clamp": "min" }
```

If any dimension risks overflow, Apex instructs the callee to emit a bounded summary + ≤3 clarifying questions.

---

## 5) Refusal Normalization (Unchanged)

Apex maps plane-specific or tool-specific codes to the unified platform taxonomy using `config.refusal_aliases`.

---

## 6) Audit Spine (Emitted Every Run)

Required fields: `exec_id`, `route`, `budgets.requested|granted|consumed`, `termination`, `metrics`, `provenance`.
Hash-chained via `audit.hashing` and redacted per `audit.provenance`.

---

## 7) Public Interfaces (Unchanged)

```ts
export type RouteInput = {
  intent: string;
  payload: unknown;
  callerBudgets?: Budgets;
  trace?: { parent_exec_id?: string };
}

export type RouteOutput =
  | { kind: 'BOUNDED_OUTPUT'; payload: unknown; audit: Audit }
  | { kind: 'REFUSAL'; code: string; cause: string; audit: Audit };
```

---

## 8) Reference Implementation (Updated excerpt)

```ts
function route(req: RouteInput): RouteOutput {
  const m = state.manifest;
  const R = state.registryView;
  const plane = resolvePlane(req.intent, R.intentMap) ?? 'mpa';
  if (state.hops >= R.hopsMax) return refusal('BOUND_DEPTH','Hop limit exceeded');

  // compute effective budgets
  const defaults = R.defaults;
  const profile = R.routeBudgets?.[plane] ?? {};
  const budgets = clampBudgets(req.callerBudgets, defaults, profile, R.policy.route_profile_clamp);

  const res = callPlane(plane, { payload: req.payload, budgets });
  const out = normalizeRefusals(res, R.refusalAliases);
  return withAudit(out, buildAudit({ plane, budgets }));
}
```

---

## 9) Security & Privacy (No Change)

Same least-visibility and PII-masking rules apply.

---

## 10) Acceptance Tests (Extended)

| ID | Description |
|----|--------------|
| **T1 Routing** | Intent → correct plane; no sub-entry calls. |
| **T2 Budgets** | Caller narrows respected; overflow → bounded result. |
| **T3 Depth** | Hop limit exceeded → `REFUSAL(BOUND_DEPTH)`. |
| **T4 Aliases** | Tool/plane codes normalized to surface set. |
| **T5 Audit** | All spine fields populated; hash chain intact. |
| **T6 Determinism** | Same inputs + manifest → identical outputs. |
| **T7 Route Profiles (new)** | Verify per-route budgets applied (`mpa.rumpole=1800`, `mpt.* tool_calls_max=6`, `web_requests_max=3`). |

---

## 11) Migration Notes

Older manifests without `route_budgets` are still valid; Apex simply treats `route_profile_cap` as undefined → falls back to `(defaults, caller_request)` clamp.

---

12. System-Level TAC (Global Temporal Attestation Channel)
12.0 Rationale

Apex is the manifest-driven orchestration layer and is the natural place to own global temporal authority:

Apex performs routing and budget enforcement for the whole system.

A system-level TAC issued by Apex can be used to gate operations across all planes without trusting client clocks.

Controller-level invocation allows operators or governance to impose system-wide time gating (e.g., embargo, maintenance windows, legal holds).

12.1 High-level guarantees

Central authority: Apex Keeper (system controller) is the canonical issuer of global TACs.

Platform enforcement: All planes treat Apex-issued TACs as authoritative for lock decisions; client-supplied TACs are ignored unless endorsed by Apex.

Auditable: Every global TAC and lock operation is recorded in the audit spine emitted by Apex (and mirrored into plane audits).

12.2 Manifest additions (manifest.json)

Add a tac_policy section to manifest.json:

"tac_policy": {
  "enabled": true,
  "allow_caller_invoke": true,
  "authorized_invokers": ["admin-role","governance-id"],
  "default_flags": ["response-gate"],
  "max_duration_s": 31536000000, // 1000 years safe default, null=unbounded
  "key_rotation_policy": {"rotation_interval_days": 365, "retention_years": 25}
}

Notes: allow_caller_invoke=false disables user/controller-issued global locks; otherwise invocations must be authorized via authorized_invokers.

12.3 API — Issuing a Global TAC / Lock

Apex exposes an administrative API (authenticated + auditable). Example endpoints (Apex is authoritative; callers must authenticate & be allowed by manifest):

POST /apex/tac/issue
Headers: Authorization: Bearer <admin-token>
Body: {
  "caller_id": "governance-id",
  "scope": "system" | "route:mpa" | "resource:/files/uuid",
  "duration_s": 126144000000,
  "flags": ["immutable","response-gate"],
  "reason": "archival embargo",
  "governance_hash": "sha256:..." // optional
}

Response (200):

{
  "tac": "v=1;e=E2;s=101;t=1730135400;n=G7QJ;c=BASE32...",
  "lock_id": "LCK-urn:uuid:abcd",
  "expires_at": 2145135400,
  "signed_by": "apex-keeper-01",
  "audit_entry_id": "exec-..."
}
12.4 Authorization & Invocation Rules

Authorized invokers only: Apex verifies caller_id against manifest.tac_policy.authorized_invokers and additional ACLs if configured in config.acls.

Delegation: Apex supports delegated invokers (signed delegation tokens) with TTLs.

Emergency bypass: A governance-signed FORCE_UNLOCK API exists; its use is heavily audited and requires multi-party signatures (configurable quorum).

12.5 Propagation & Enforcement

Propagation: Apex publishes the new TAC/Lock to all active planes and to the Audit Spine. Planes must record receipt and reflect tac in their local audit envelopes.

Plane compliance: On receiving a global TAC, each plane updates its local TACChain and uses Apex TAC to enforce locks in their engines (e.g., MPS in-file locks, MPT tool gating, MPA content gating).

Request-time enforcement: On any incoming request, Apex first checks active global locks and will refuse or redact with REFUSAL(LOCK_ACTIVE) if the request intersects an active scope and policy forbids it.

12.6 Example: Issuing a 4000-Year System Lock

If tac_policy.max_duration_s is lower than requested, Apex refuses with REFUSAL(TAC_DURATION_EXCEEDS_POLICY) unless caller has override.

If allowed, Apex returns a TAC with duration_s = 4000*365.25*86400 and sets expires_at = tac.t + duration_s.

Apex records advisory fields in the audit envelope documenting key rotation, algorithm durability, legal notes.

Behavior: All planes will enforce the lock until expiry or until an authorized UNLOCK is recorded by Apex. The Keeper includes human-readable advisories in audit to warn about cryptographic aging.

12.7 Unlocking & Revocation

UNLOCK API: POST /apex/tac/unlock requires lock_id, caller_id, reason, and multi-sig if required.

Governance force-unlock: POST /apex/tac/force-unlock requires configured quorum of governance actors.

Revocation record: Every UNLOCK is stored in the Audit Spine and referenced in with audit entries across planes.

12.8 Audit Envelope & TAC fields

Apex emits a spine-level tac block in the audit envelope for each run that reflects the active global TACs:

"tac_global": {
  "active": ["LCK-urn:uuid:abcd"],
  "latest": "v=1;e=E2;s=101;t=1730135400;n=G7QJ;c=...",
  "tac_policy_snapshot": { ... }
}

Planes mirror this block into their local audit.tac for deterministic cross-checking.

12.9 Failure Modes & Refusal Taxonomy

Add Apex-level refusals:

TAC_UNAUTHORIZED — caller not permitted

TAC_DURATION_EXCEEDS_POLICY — exceeds manifest max

TAC_LOCK_CONFLICT — lock conflicts with existing immutable lock and no override

TAC_KEY_ROTATION_MISCONFIG — cannot issue long-duration lock due to key policy

12.10 Key Rotation & Long-Term Validation

Apex must publish and include in audits:

key rotation schedule

historic key snapshots (signed) needed to validate old TACs

integrity policy for algorithm migration

12.11 Determinism & Replay

Global TACs are part of the exec hash chain and must be included in exec_id derivation so that same inputs + same TACs → same outputs.

For replay, verifiers must fetch historic key snapshots and the Apex audit spine.

12.12 Backwards Compatibility

Planes that do not understand Apex global TACs must treat incoming TACs as audit-only and log a warning. Manifest tac_policy can include a compatibility_mode flag to control behavior.

Example Interaction (Full)

Admin calls POST /apex/tac/issue with duration_s = 4000 years and flags=[response-gate].

Apex authorizes, issues TAC, records lock in audit, and publishes to planes.

Plane MPS sees active lock; its in-file LOCKs that intersect the global scope are considered active and will enforce response-gate semantics.

Any client request that would touch locked content returns REFUSAL(LOCK_ACTIVE) with audit ID.

---

*Status: Apex v1.1 updated for manifest-level per-route budget enforcement.*

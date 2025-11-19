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

*Status: Apex v1.1 updated for manifest-level per-route budget enforcement.*
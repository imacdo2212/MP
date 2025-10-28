# MPT v1.0 — Meta-Prompt Tooling Kernel

## 0) Identity & Prime Directive
- **Name:** MPT (Meta-Prompt Tooling)
- **Role:** Deterministic plane for safe, bounded, auditable execution of external tools.
- **Parent System:** Apex (Unified Orchestration Layer)
- **Prime Directive:** Every operation must terminate in **BOUNDED_OUTPUT** or **REFUSAL(code)**. No unbounded calls, recursion, or network drift.

## 1) Purpose & Context
The MPT kernel provides a controlled environment to execute approved tools (e.g., web search, code execution, image generation) within deterministic bounds. It resolves the existing **Controlled Tool Denial** architecture by introducing a sandboxed tooling plane with its own budgets and refusal taxonomy.

### Objectives
1. Enable Apex to route `tool.*` namespaces deterministically.
2. Allow bounded tool invocation under MPC threat-scan supervision.
3. Provide unified audit, safety, and refusal normalization for tool events.
4. Ensure compatibility with MPX diagnostics and Apex audit schema.

---

## 2) Budgets & Halting
```json
{
  "time_ms": 30000,
  "mem_mb": 256,
  "gas": 6000,
  "depth": 4,
  "tool_calls_max": 6,
  "web_requests_max": 3,
  "tokens_output_max": 800
}
```
- Exceeding any budget → `REFUSAL(BOUND_*)`.
- Each tool call consumes measurable gas; budget halts prevent overuse.
- No background or chained executions.

---

## 3) Tool Safety & Governance
### Policy
- All tools must be **declared in registry** with contract metadata: `{tool_id, io_schema, safety_level}`.
- Unsafe, unverified, or undeclared tools → `REFUSAL(SAFETY_POLICY)`.
- ThreatScan (MPC) pre-screens every call, verifying domain, token safety, and configuration.

### Allowed Tool Classes
| Category | Example Tools | Notes |
|-----------|----------------|-------|
| **web** | search, open_url | 3 requests per run max; content normalized |
| **code** | python, js | sandboxed; memory and execution time bounded |
| **image** | text2im, edit | outputs validated for policy compliance |
| **data** | csv, xlsx parser | deterministic reads only; no writes |

---

## 4) Refusal Taxonomy (Tool-Specific)
| Condition | MPT Code | Apex Normalized Code | Description |
|------------|-----------|----------------------|--------------|
| Tool timeout | `TOOL_TIMEOUT` | `BOUND_TIME` | Tool exceeded time budget |
| Tool failure (non-critical) | `TOOL_FAIL` | `FRAGILITY` | Runtime or I/O error |
| Unsafe or unverified tool | `TOOL_UNSAFE` | `SAFETY_POLICY` | Violated policy or sandbox rule |
| Budget exceeded | `BOUND_*` | `BOUND_*` | Exceeded internal budget |
| Missing contract/schema | `TOOL_SCHEMA_MISS` | `DIS_INSUFFICIENT` | Tool lacked valid I/O schema |
| External network drift | `TOOL_DRIFT` | `CONFLICT_PST` | Nondeterministic external behaviour |

---

## 5) Interface Contract
### Input Schema
```json
{
  "tool": "string",         // e.g., web.search, code.run
  "input": "object",        // validated against io_schema.in
  "budget": {"time_ms":30000,"mem_mb":256,"depth":4},
  "context": {"caller":"Apex","exec_id":"string"}
}
```

### Output Schema
```json
{
  "output": "object",        // validated against io_schema.out
  "metrics": {"latency_ms":0,"gas_used":0,"tool_id":"string"},
  "termination": "BOUNDED_OUTPUT | REFUSAL(code)",
  "audit": {"exec_id":"uuid","route":"mpt","budgets":{},"refusals":[],"timestamp":"ISO8601"}
}
```

---

## 6) Audit Spine (Apex-Compatible)
Each tool run emits deterministic audit logs with the following fields:
```json
{
  "exec_id": "hash",
  "route": "mpt.<tool>",
  "budgets": {"requested":{},"consumed":{}},
  "termination": "BOUNDED_OUTPUT | REFUSAL(code)",
  "metrics": {"latency_ms":0,"gas":0,"tool_calls":1},
  "tool_metrics": {"failures":0,"timeouts":0},
  "provenance": {"caller":"Apex","sandbox":"true"}
}
```
- Logged to MPX diagnostic spine for replay and certification.

---

## 7) Routing & Integration
- Apex **adds new block** `[registry.mptool]` with mappings (e.g., `namespace.tool.web = "MPTool@1.0"`).
- **Routing Order Update:** `if ns ∈ registry.mptool → target_id := MPT`.
- MPC’s `tool_calls_max = 0` overridden for route == `MPT`.
- ThreatScan validates before forwarding request to MPT.

---

## 8) Quality Gates
| Gate | Requirement | Outcome |
|-------|--------------|----------|
| **Clarity Gate (E)** | E ≥ 0.75 | else `REFUSAL(ENTROPY_CLARITY)` |
| **Tool Integrity Gate** | Schema + Safety pass | else `REFUSAL(SAFETY_POLICY)` |
| **Audit Gate** | Must emit valid audit envelope | else `REFUSAL(FRAGILITY)` |

---

## 9) Audit & Verification Tests
1. **T01:** Exceeding budget triggers `REFUSAL(BOUND_*)`.
2. **T02:** Undeclared tool triggers `REFUSAL(SAFETY_POLICY)`.
3. **T03:** Invalid I/O schema triggers `REFUSAL(DIS_INSUFFICIENT)`.
4. **T04:** Successful tool run emits valid audit envelope.
5. **T05:** Concurrent tool calls ≤6; overflow → `REFUSAL(BOUND_GAS)`.

---

## 10) Output Classes
- **Tool Result:** structured output within declared schema.
- **Tool Report:** summarized metrics for MPX / Apex audits.
- **Tool Ledger Entry:** append-only record for reproducibility.

---

## 11) Future Extensions
- Add `mptool.analytics` for telemetry and trend aggregation.
- Integrate deterministic caching layer (shared with Apex).
- Optional **Toolchain Validation Harness** for third-party plug-ins.
- Dynamic risk scoring to auto-adjust `tool_calls_max` per session.

---
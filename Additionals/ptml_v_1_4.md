# PTML v1.4.1 — Prompt Task Markup Language (Patched)

> This is a bounded, deterministic orchestration language for AI workflows. v1.4.1 folds in structural fixes, a unified type model, a deterministic init primitive, clarified timing and gate semantics, race/fallback placement checks, loop-bound linkage, and normalization controls.

---

## 0. Changelog (v1.4 → v1.4.1)

**Added**
- Strict LIFO block-closing semantics; misnesting → compile error.
- `/set` deterministic init primitive for nested state creation.
- Unified state/expr/JSON-Schema compatibility table.
- `when` timing semantics for `[/assert]` (including within-step usage).
- Plan-level gate behavior when `confidence_min` is set but no confidences are present; `confidence_policy` option.
- Static placement checks for `race`/`fallback` blocks.
- Loop bound linkage to sized containers and checker-visible constants.
- Per-field normalization controls for P>S>T provenance.

**Changed**
- Attribute lists: deprecate PTML custom `list` literal in favor of JSON arrays.
- Example program corrected for structural clarity.

**Clarified**
- Tool I/O schema ↔ state type mapping rules and coercions.
- Cancellation semantics in `race`.

---

## 1. Core Concepts

- **Determinism:** Same inputs → same outputs (within budgets). No async or background work. All control flow is structurally bounded.
- **Blocks:** PTML uses delimited blocks with explicit openers and a generic `[/end]` closer.
- **State:** Typed, declared up-front; all writes target declared paths.
- **Tools:** External capabilities with JSON Schema contracts (`io_schema.in` / `io_schema.out`).
- **Plan:** Steps with guards, calls, asserts, races, retries, fallbacks, bounded loops; ends with a gate and an emit.
- **Budgets:** time_ms, mem_mb, gas, depth at global/tool/step precedence.
- **Provenance P>S>T:** Primary > Standards > Tutorials ordering; equal-tier conflicts require deterministic resolution.

---

## 2. Grammar (EBNF)

```
Program  = PTML, Budget?, Tool*, State, Plan, Emit, Audit, End;
PTML     = "[/ptml", Attr+, "]";
Budget   = "[/budget", Attr+, "]", End;
Tool     = "[/tool", Attr+, "]", End;
State    = "[/state", "]", StateDecl+, End;
Plan     = "[/plan", "]", Step+, Gate, End;
Emit     = "[/emit", Attr+, "]", End;
Audit    = "[/audit", Attr+, "]", End;

Step     = "[/step", Attr+, "]", StepBody, End;
StepBody = ( Guard | Call | Assert | Race | For | Set )*;
Guard    = "[/guard", Attr+, "]", End;
Call     = "[/call", Attr+, "]", End;
Assert   = "[/assert", Attr+, "]", End;
Race     = "[/race", Attr+, "]", Branch+, End;
Branch   = "[/branch", Attr*, "]", ( Guard | Call | Assert | Set )*, End;
For      = "[/for", Attr+, "]", ( Guard | Call | Assert | Race | Set )*, End;
Set      = "[/set", Attr+, "]", End;           // NEW deterministic init
Gate     = "[/gate", Attr+, "]", End;
End      = "[/end]";

Attr     = ident, "=", ( json | string | number | bool | ident );
```

**LIFO closing rule:** Parsing uses a strict stack; each `[/end]` closes the most recent not-yet-closed opener. Any mismatch or orphan `[/end]` is a compile error naming the opener and source position.

**Attribute validation:** Unknown attributes on any block are compile errors.

---

## 3. Types

### 3.1 State Types

Primitive: `text | url | int | float | bool | datetime`

Containers: `object`, `array<T>`, `Vector[T, <=N]`, `Matrix[T, R, C]`, `Tree[T, <=H]`

- `object` holds key→typed value mappings (declared inline or open schema).
- `array<T>` is unbounded in theory but must be bounded by budgeted writes; for loop writes prefer `Vector` with explicit `<=N` bound.

### 3.2 Expressions

- Expressions operate over state values and literals and evaluate to one of: `text|int|float|bool|object|array`.
- `len(x)`, `exists(path)`, `count_bullets(text)`, etc. are standard library predicates (implementation-defined but deterministic).

### 3.3 JSON Schema ↔ State Type Compatibility

| JSON Schema fragment | State type mapping | Notes |
|---|---|---|
| `{type:"string"}` | `text` | `format:"uri"` → `url` accepted.
| `{type:"number"}` | `float` | Can coerce to `int` only with `coerce="loose"` and `multipleOf:1`.
| `{type:"integer"}` | `int` | May widen to `float` with `coerce="loose"`.
| `{type:"boolean"}` | `bool` | –
| `{type:"array", items:S}` | `array<T(S)>` or `Vector[T(S),<=N]` | Use `Vector` for indexed writes with loop bounds.
| `{type:"object", properties:{...}}` | `object` | Keys/types must be compatible; extra fields policy controlled (see below).
| `anyOf / oneOf` | **Only** if all arms map to the same state type | Otherwise compile error.

**Call output rule:** `/call out="path.to.state"` must target a declared path with a compatible state type per the table. Vendor responses are validated at runtime against `io_schema.out`.

**Coercion policy:** On `/call`, optional `coerce="none|loose"` (default `none`).
- `loose` allows: integer→int/float, number→float, object supersets (extra fields ignored) if the target state is open-schema.

---

## 4. State Declarations & Paths

- Declare state inside `[/state] ... [/end]` with one item per line: `name: type` or nested object structures.
- Writes must target **predeclared** paths.
- Nested writes require the container to exist; create deterministically with `[/set]` (see §6).

**Normalization controls (for P>S>T):** Annotate text-bearing fields with `norm`:
- `norm="exact|trim|casefold|url"` (default `trim+casefold`). `url` performs RFC-aware normalization (lowercase host, preserve path case; no trailing slash addition).

---

## 5. Control Flow

### 5.1 Guards

```
[/guard expr="len(src)>0"][/end]
```
If false, the enclosing step is skipped (no calls run); retries/fallbacks may proceed per step attributes.

### 5.2 Calls

```
[/call tool="llm.primary" in={"text":src} out="summary" coerce="none"][/end]
```
- `in` JSON validated at compile time against `io_schema.in` where static.
- `out` path must be declared and type-compatible; vendor runtime validation is mandatory.

### 5.3 Asserts & Timing

`[/assert when=...]` supports:
- `after:STEP_ID` — after all calls in that step complete (including retries, fallback resolution, and races) and **before** the plan-level gate.
- `after:this` — synonym valid **inside** the current step.
- `after:last_call` — after the last call in the current lexical context (step or branch) completes.

Failure → `on_fail="REFUSAL(FRAGILITY|ENTROPY_CLARITY)"` or default `REFUSAL(FRAGILITY)`.

### 5.4 Race & Branches

```
[/race mode="first_success"]
  [/branch id="A"] ... [/end]
  [/branch id="B"] ... [/end]
[/end]
```
- First successful branch wins; losing branches are canceled. Side effects already performed (time/gas) remain in audit.
- **Placement rule:** No `Assert` or `Gate` **after** a `race` in the same step unless located **inside** each branch. Violations → compile error.

### 5.5 Retries & Fallbacks

- Step attrs: `retry=<int>` (bounded), `fallback="STEP_ID"` (DAG enforced). Fallback graphs must be acyclic; cycles → compile error.

### 5.6 Bounded Loops

```
[/for var i start=0 end=len(urls) inclusive=false]
  ... writes to results[i] ...
[/end]
```
- The checker must prove trip count `≤` a known bound.
- **Sized bound linkage:** Declaring `Vector[T,<=N] results` exposes constant `#results.N` to the checker. The proof obligation for indexed writes is `(end-start+(inclusive?1:0)) ≤ #results.N`.
- If `end=len(X)` appears, proof requires `len(X) ≤ #X.N` or dominating guards that establish it.

---

## 6. Deterministic Init — `/set` (NEW)

```
[/set path="answers" value=[]][/end]
[/set path="user.profile" value={}] [/end]
```
- Creates any missing intermediate containers at `path` deterministically.
- Type-checks `value` against the declared state type.
- Enables subsequent writes like `answers[0] = ...` or `user.profile.name = ...`.

---

## 7. Gate & Termination

```
[/gate require_assertions_min=1 require_nonempty_emit=true confidence_min=0.85 confidence_policy="require_if_set"][/end]
```
- Gate runs after all steps (and their fallbacks) complete.
- **Confidence behavior:**
  - If `confidence_min` is set and **no** tool emitted a `confidence`, then:
    - If `confidence_policy="require_if_set"` → gate fails with `REFUSAL(ENTROPY_CLARITY)` and diagnostic "no confidence available".
    - If `confidence_policy="ignore_if_missing"` (default) → threshold is ignored.
- Also enforces: min passed asserts, non-empty emit fields, and no unhandled refusals.

---

## 8. Budgets, Gas, Depth

- Budgets apply at program/tool/step precedence (step overrides tool overrides program).
- Gas is computed deterministically per block type; races and retries charge overhead.
- Depth limits maximum nesting (including branch stacks).

---

## 9. Static Checks (Compile-Time)

- Unknown attributes on any block.
- LIFO closing (misnesting, extra `[/end]`).
- Undeclared state paths; writes without prior deterministic creation when needed.
- Tool schema ↔ state type compatibility; forbidden coercions.
- `race`/`assert` placement violations.
- Fallback graph cycles.
- Loop bound proof obligations against sized containers.
- Emit field existence and declared types.

---

## 10. Runtime Checks

- Vendor response validation against `io_schema.out`.
- Gate conditions (assert counts, non-empty emit, confidence policy).
- Budget enforcement (time/mem/gas/depth), with metered audit emission.

---

## 11. Example (Corrected & Updated)

```ptml
[/ptml version="1.4.1" name="SumUp"]
  [/budget time_ms=30000 mem_mb=256 gas=6000 depth=4][/end]

  [/tool id="llm.primary" kind="llm"
    io_schema={"in":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"]},
               "out":{"type":"string"}}
    budgets={"time_ms":12000}][/end]

  [/tool id="llm.backup" kind="llm"
    io_schema={"in":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"]},
               "out":{"type":"string"}}
    budgets={"time_ms":10000}][/end]

  [/state]
    src: text
    summary: text norm="trim"
  [/end]

  [/plan]
    [/step id="S0"]
      [/guard expr="len(src)>0"][/end]
    [/end]

    [/step id="S1" retry=1 fallback="S1b" time_ms=12000]
      [/call tool="llm.primary" in={"text":src} out="summary" coerce="none"][/end]
      [/assert when="after:this" expr="count_bullets(summary)==5" on_fail="REFUSAL(FRAGILITY)"][/end]
    [/end]

    [/step id="S1b" time_ms=10000]
      [/call tool="llm.backup" in={"text":src} out="summary"][/end]
    [/end]

    [/gate require_assertions_min=1 require_nonempty_emit=true confidence_min=0.85 confidence_policy="require_if_set"][/end]
  [/end]

  [/emit fields=["summary"] format="markdown"][/end]
  [/audit include=["exec_id","route","budgets","consumed","termination","runtime_config"]][/end]
[/end]
```

---

## 12. Acceptance Criteria (for Implementers)

1. Misnested `[/end]` yields a compile error naming the opener and position.
2. Writing to `user.profile.name` without `[/set path="user.profile" value={}]` is a compile error.
3. Tool with `out:{type:"object"}` cannot target `summary: text` unless coercion expands `summary` to `object` (or changes schema accordingly).
4. With `confidence_min` set and missing confidences, gate fails per `confidence_policy`.
5. Any assert placed after a `race` (outside branches) produces a compile error.
6. For-loop over `i` writing to `results[i]` proves `trip_count ≤ #results.N` or is rejected.
7. URLs declared with `norm="url"` compare equal if they differ by host case only; path case is preserved.

---

## 13. Glossary

- **Gate:** Final plan checkpoint that enforces global correctness conditions before emit.
- **Provenance:** Tiered source-of-truth policy (Primary > Standards > Tutorials).
- **Checker:** Static analysis component responsible for proofs (bounds, compatibility, placement).

---

## 14. License & Reproducibility

This document is sufficient to reproduce the v1.4.1 validator behavior referenced above. All examples are non-executable specifications intended for offline validation tooling.


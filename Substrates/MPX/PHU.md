# PHU Refractor v1 — Kernel-to-Module Compiler

> **Purpose:** Define a kernel-agnostic compiler that transforms multi-phase kernels into bounded, host-agnostic single-prompt modules. Includes manifest format for managing multiple modules.

---

## 0) Design Goals
- **Kernel Agnosticism:** Work with any conformant kernel specification.
- **Deterministic Boundaries:** End runs with `BOUNDED_OUTPUT` or `REFUSAL(code)`.
- **Shrink-wrapped Prompts:** Encode all budgets, gates, and refusals in text.
- **Governance Integrity:** Preserve taxonomy and traceability.
- **Round-Trip Ready:** Retain metadata for MPX rehydration.
- **Manifest Integration:** Support modular registry management and batch compilation.

---

## 1) Transformation Flow

### Step 1: Kernel Intake
Structured kernel specification must include:
- Identity and scope
- Budgets (words, tables, sections)
- Metrics and gate thresholds
- Refusal taxonomy
- Output schema (sections, tables)
- Optional: modes, appendices, tone modifiers

### Step 2: PHU Intermediate Representation (PHU‑IR)
```json
{
  "module_id": "",
  "kernel_ref": "",
  "identity": {"name": "", "scope": "", "persona": "", "exclusions": []},
  "mode": {"id": "", "label": ""},
  "budgets": {"words_max": 220, "tables_max_rows": 6, "sections_max": 5},
  "metrics": [],
  "gates": {"green": 0.85, "yellow_min": 0.70, "red": 0.70},
  "refusals": {
    "allowed": [],
    "style": "one-line cause + ≤3 minimal unblockers"
  },
  "citations": {"style": "short-name only", "allowed": true},
  "output_form": [],
  "appendices": {},
  "modifiers": {}
}
```

### Step 3: Template Rendering
Use template logic to translate PHU‑IR into a standalone prompt string that includes:
- Prime Directive
- Identity & Scope
- Budgets (verbalized)
- Metrics & Gate thresholds
- Refusal codes and style
- Output schema headings
- Optional appendices

---

## 2) Module Envelope Specification
Each generated module is emitted as a JSON record:
```json
{
  "module_id": "<namespace>.<name>.<mode>@<version>",
  "kernel_ref": "<source_kernel>@<version>",
  "scope": "<short domain scope>",
  "budgets": {"words_max": 220, "tables_max_rows": 6},
  "metrics": [],
  "gate": {"green": 0.85, "yellow_min": 0.70},
  "output_form": [],
  "refusals": [],
  "prompt_text": "<compiled prompt string>",
  "examples": []
}
```

---

## 3) Prompt Shell Template
```
SYSTEM — {{identity.name}} ({{mode.label}} | Dehydrated)
Prime Directive: End with BOUNDED_OUTPUT or REFUSAL(code). No background work.

Identity & Scope: {{identity.scope}}. Assistive; not a substitute for {{identity.persona}}.
Budgets: ≤{{budgets.words_max}} words; tables ≤{{budgets.tables_max_rows}} rows; ≤{{budgets.sections_max}} sections.
Metrics & Gate: Compute {{metrics}} → CCI or equivalent measure.
Green ≥{{gates.green}} → work product; Yellow {{gates.yellow_min}}–{{gates.green - 0.01}} → review required; Red <{{gates.red}} → REFUSAL with diagnostics.
Refusals: {{refusals.allowed}}. Style: {{refusals.style}}.
Output Form (strict): {{output_form}}
Optional Appendices: {{appendices}}
Tone: concise and domain-appropriate.
```

---

## 4) Algorithm (Pseudocode)
```pseudo
function build_module(kernel_spec, mode_id):
  ir = extract_ir(kernel_spec, mode_id)
  validate(ir)
  prompt_text = render(template.shell, ir)
  return {
    module_id: compose_id(kernel_spec, mode_id),
    kernel_ref: kernel_spec.ref,
    scope: ir.identity.scope,
    budgets: ir.budgets,
    metrics: ir.metrics,
    gate: ir.gates,
    output_form: map(ir.output_form, label),
    refusals: ir.refusals.allowed,
    prompt_text: prompt_text
  }
```

Validation Rules:
- Budgets must be numeric.
- Refusal taxonomy includes at least one safety code and `BOUND_*`.
- Output form contains 2–5 sections.

---

## 5) PHU Manifest Format (Multi‑Module Registry)
Defines a batch of modules compiled from multiple kernels or modes.
```json
{
  "phu_manifest_version": "1.0",
  "generated": "2025-10-10T00:00:00Z",
  "compiler_version": "PHU Refractor v1",
  "registry": [
    {
      "kernel_ref": "<kernel>@<version>",
      "modules": [
        {
          "module_id": "<namespace>.<kernel>.<mode>@<version>",
          "status": "active|deprecated",
          "checksum": "<sha256>",
          "budgets": {"words_max": 220},
          "metrics": [],
          "refusals": [],
          "dependencies": [],
          "output_form": [],
          "tags": ["legal","triage"],
          "prompt_path": "./modules/<kernel>/<mode>.prompt.txt"
        }
      ]
    }
  ]
}
```

### Notes
- Each manifest entry corresponds to one kernel and its compiled modules.
- `checksum` ensures immutability for audit.
- `tags` and `status` help manage lifecycle (e.g., beta, deprecated).
- `dependencies` supports composite module builds.

---

## 6) Registry and Governance
- Modules and manifests are versioned independently.
- `kernel_ref` provides lineage back to source kernels.
- Manifests enable automated loading, validation, and publication.
- Public modules remain sandboxed and deterministic.

---

## 7) Implementation Notes
- Keep compiled prompts under ~400 tokens.
- Support host‑specific variations at render time (Copilot, Cursor, etc.).
- Provide CLI/SDK utilities for manifest creation, validation, and diffing.
- Rehydration uses manifest mapping to locate full kernel specs.

---

## 8) Future Extensions
- Add manifest bundling for environment‑specific deployments.
- Introduce semantic versioning of module dependencies.
- Implement automated gate calibration metrics across modules.
- Extend manifest schema to support internationalization packs.

---

**Status:** Complete kernel‑agnostic PHU Refractor with manifest registry schema and governance structure.


---

## 9) Pilot Module Pack (External Trials)
**Goal:** Ship a single bounded module for evaluation without exposing kernels.

**Pack Contents**
- `module.prompt.txt` — dehydrated prompt text (bounded; no tools).
- `module.manifest.json` — minimal schema:
```json
{
  "module_id": "<ns>.<name>.<mode>@<ver>",
  "checksum": "<sha256-of-prompt>",
  "budgets": {"words_max": 220, "tables_max_rows": 6},
  "output_form": ["Main Brief","Core Table","Confidence"],
  "refusals": ["BOUND_*","SAFETY_POLICY","ENTROPY_CLARITY"],
  "expiry": "2025-12-31",
  "watermark": "<embedded-phrase-id>",
  "terms_ref": "pilot-license-v1"
}
```
- `usage_card.md` — paste/run instructions + expected I/O shape.
- `eval_rubric.json` — objective checks (see §10).
- `license.txt` — pilot license (see §11).

**Build Command (conceptual)**
```
phu build --kernel <file> --mode <id> --out ./pilot_pack/ \
  --expire 30d --salt <client-id> --watermark auto --checksum sha256
```

## 10) Evaluation Rubric (Template)
```json
{
  "tests": [
    {"id": "precision", "desc": "Meets task acceptance criteria", "metric": ">=80%"},
    {"id": "budget_compliance", "desc": "Respects word/row caps", "metric": "100%"},
    {"id": "refusal_correctness", "desc": "Refuses unsafe/ambiguous correctly", "metric": ">=95%"},
    {"id": "stability", "desc": "Same input → consistent sections/format across 3 runs", "metric": "pass"}
  ],
  "harness": {
    "validator": "checks sections, row caps, refusal codes",
    "inputs": {"canned": 5, "byo": 5}
  }
}
```

## 11) Security & Anti‑Leak Controls
- **Checksum:** SHA of `module.prompt.txt` in manifest; reject if mismatched.
- **Watermark:** Short neutral phrase embedded once; unique per client via `--salt`.
- **Scope Guard:** Non‑goals and out‑of‑scope triggers → `REFUSAL(BOUND_*)`.
- **Telemetry:** Default off. Optional metrics‑only (rubric pass/fail counts), no content.
- **Expiry:** Manifest `expiry` enforced by harness; after date → refuse to load.

## 12) Pilot License (Stub)
- **Grant:** Evaluation‑only, non‑exclusive, non‑transferable; no redistribution.
- **Restrictions:** No prompt mining, no model distillation, no derivatives.
- **Attribution:** Remove watermarks prohibited; tamper detection allowed for audit.
- **Term:** Time‑boxed; auto‑terminate on expiry or breach.

## 13) Varianting Strategy
- **Per‑Client Salt:** Minor lexical variation + watermark id; identical behavior, traceable text.
- **Budget Profiles:** `small|standard|plus` word caps switched at compile time.
- **Host Skins:** Copilot/Cursor shells with identical core constraints.

## 14) Ops Pipeline (Internal)
1. Kernel → **PHU compile** (mode) → prompt.
2. Generate checksum, watermark, and mini manifest.
3. Auto‑emit `usage_card.md` and `eval_rubric.json` from manifest.
4. Package Pilot Module Pack; register `module_id`, recipient, and expiry.
5. Post‑trial: ingest rubric results; if deal proceeds, promote to managed modules without exposing kernels.


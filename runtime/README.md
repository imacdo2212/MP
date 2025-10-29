# MP Runtime

This workspace hosts a NestJS-based orchestrator runtime that materializes the Apex manifest policies, budget clamps, and audit ledger described in the repository blueprints.

## Prerequisites
- Node.js 20+
- PostgreSQL instance (default connection string `postgresql://localhost:5432/mp_runtime`)

## Installation
```bash
npm install
```

## Database
Run the migration to provision the append-only `audit_ledger` table:
```bash
npm run migrate
```

## Commands
- `npm start` – boot the Fastify-based NestJS ingress on `HOST`/`PORT` (defaults `0.0.0.0:3000`).
- `npm run demo` – execute the manifest loader and ledger demo script.
- `npm run check` – type-check the codebase.
- `npm test` – run Vitest suites, including ingress and budget clamp acceptance cases.

## Capability modes
The runtime now ships with a local legal-analysis adapter and three execution modes controlled by `CAPABILITY_MODE`:

- `local` (default) – attempts to satisfy a route with a registered adapter and falls back to the deterministic placeholder when no adapter is available.
- `placeholder` – always returns the placeholder envelope regardless of adapter availability (useful for contract testing).
- `disabled` – raises a capability outage so the orchestrator emits `REFUSAL(DIS_INSUFFICIENT)`.

## First-party capability adapters

The runtime provides deterministic adapters for each routed domain in the Apex manifest:

- **Rumpole legal analysis (`mpa.rumpole`)** – extracts summaries, parties, obligations, termination clauses, risk flags, and question coverage from contract text, annotating responses with `metadata.adapter = "rumpole"`.
- **Doctor Martin clinical triage (`mpa.doctormartin`)** – normalizes vitals and symptoms to return triage disposition, red flags, and recommended actions. Emergent findings trigger EMS guidance while honoring manifest budgets.
- **DfE lesson planning (`mpa.dfe`)** – transforms learner objectives and observations into a sequenced lesson plan, success criteria, and evidence plan without external services.
- **MPE engineering workplan (`mpe`)** – builds phased engineering plans that include tasks, risk mitigations, and metrics for project objectives using stack/constraint context.
- **MPS scientific analysis (`mps`)** – computes descriptive statistics, summarizes evidence, surfaces risks, and proposes next experiments from supplied datasets and hypotheses.
- **MPT toolkit playbooks (`mptool`)** – produces multi-tool execution plans with inferred tool calls, parameters, and deterministic fallbacks for automation intents.

Each adapter consumes no external APIs, keeps budget consumption within the granted envelope, and returns structured outputs that align with the manifest’s audit expectations. Routes without a registered adapter continue to fall back to the placeholder capability.

## Audit ledger
Every orchestration attempt writes a hash-chained audit frame. Configure the ledger connection with `DATABASE_URL`. The service gracefully degrades if the database is unreachable, logging a warning while preserving refusal semantics. When a write fails, the HTTP response metadata includes `{ "ledgerWriteFailed": true }` so callers can surface temporary persistence gaps while the runtime remains deterministic.

## Exec IDs & determinism
Exec IDs are derived from a hash of the intent, payload, route, and optional `requestId`. Repeating a request with the same inputs produces identical identifiers and audit hashes, aligning with the deterministic guarantees from the manifest.

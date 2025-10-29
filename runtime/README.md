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

## Placeholder capabilities
By default the orchestrator returns deterministic placeholder payloads. Set `CAPABILITY_MODE=disabled` to force `REFUSAL(DIS_INSUFFICIENT)` responses when downstream integrations are unavailable. Real adapters can replace `CapabilityService` when ready.

## Audit ledger
Every orchestration attempt writes a hash-chained audit frame. Configure the ledger connection with `DATABASE_URL`. The service gracefully degrades if the database is unreachable, logging a warning while preserving refusal semantics. When a write fails, the HTTP response metadata includes `{ "ledgerWriteFailed": true }` so callers can surface temporary persistence gaps while the runtime remains deterministic.

## Exec IDs & determinism
Exec IDs are derived from a hash of the intent, payload, route, and optional `requestId`. Repeating a request with the same inputs produces identical identifiers and audit hashes, aligning with the deterministic guarantees from the manifest.
Every orchestration attempt writes a hash-chained audit frame. Configure the ledger connection with `DATABASE_URL`. The service gracefully degrades if the database is unreachable, logging a warning while preserving refusal semantics.

## Exec IDs & determinism
Exec IDs are derived from a hash of the intent, payload, route, and optional `requestId`. Repeating a request with the same inputs produces identical identifiers and audit hashes, aligning with the deterministic guarantees from the manifest.
# MP Runtime Ingress & Capability Pipeline

This package ships a Fastify ingress service plus capability stubs so contributors can exercise the Apex manifest locally while
retaining the deterministic planning guarantees that the production stack enforces. The notes below cover the NestJS-flavoured
commands exposed through the npm scripts, database setup, runtime configuration, and a quick-start flow that proves the
capabilities and refusal codes behave as expected.

## Prerequisites & Environment

- **Node.js 20 LTS** – the TypeScript configuration and Node type definitions are pinned to the Node 20 API surface. Use a tool
  such as `nvm use 20` before installing dependencies.【F:runtime/package.json†L2-L25】
- **Environment variables**
  - `DATABASE_URL` – PostgreSQL connection string used by the connection pool; defaults to
    `postgresql://localhost:5432/mp_runtime` if not provided.【F:runtime/src/db/client.ts†L1-L13】
  - `PORT` – optional override for the ingress HTTP listener; defaults to `3000` when omitted.【F:runtime/src/index.ts†L12-L21】
  - Consider exporting these in a `.env` file or shell profile before running the service.
- **Manifest data** – the ingress bootstraps the manifest through `loadManifestConfig`, which reads the unified manifest at
  runtime so routing and refusal aliases reflect the latest policy state.【F:runtime/src/server/app.ts†L1-L26】

## Install & NestJS-style commands

The npm scripts mirror the usual NestJS workflow even though the service runs on Fastify internally:

| Command | Purpose |
| --- | --- |
| `npm run start` | Equivalent to `nest start`: launches the Fastify ingress service with logging enabled.【F:runtime/package.json†L6-L10】【F:runtime/src/server/app.ts†L12-L26】 |
| `npm run build` | Equivalent to `nest build`: compiles TypeScript to JavaScript via `tsc` for production deployments.【F:runtime/package.json†L6-L8】 |
| `npm run check` | Equivalent to `nest lint`/`nest start --check`: performs a type-only compilation to validate the codebase without emitting artifacts.【F:runtime/package.json†L6-L9】 |
| `npm run migrate` | Runs the local migration runner to provision the audit ledger tables before the API writes entries, similar to `nest build && prisma migrate` flows.【F:runtime/package.json†L6-L10】【F:runtime/src/db/migrate.ts†L1-L47】 |

Install dependencies once with:

```bash
cd runtime
npm install
```

## Database migrations

The embedded migration runner (`npm run migrate`) provisions an `audit_ledger` table sized for deterministic ExecID chains:

- The schema enforces unique `exec_id` and `record_hash` columns while storing granted/consumed budgets, termination codes, and
  optional metadata blobs.【F:runtime/src/db/migrate.ts†L3-L18】
- Migrations execute inside a single transaction; failures trigger an automatic rollback before the process exits with a
  non-zero status.【F:runtime/src/db/migrate.ts†L22-L44】
- Indexes on `route` and `created_at` assist in replaying audit trails during debugging sessions.【F:runtime/src/db/migrate.ts†L18-L19】
- When running the command against a remote database, make sure `DATABASE_URL` points to the correct instance so the audit
  writer can append records afterwards.【F:runtime/src/db/client.ts†L6-L22】

## Capability stubs & refusal codes

The ingress ships with two deterministic capability fixtures – `legalSearch` and `complianceScanner` – defined in the capability
registry. Each fixture returns a canned payload on the happy path and can emit refusal aliases for negative scenarios.【F:runtime/src/capabilities/registry.ts†L20-L115】

- **Enabling stubs** – include capability invocations in the `/ingress` request body. Each invocation can optionally set a
  `scenario` (for example `'success'`, `'timeout'`, `'failure'`, `'unsafe'`, `'schema_miss'`, or `'drift'`) to drive the desired
  outcome.【F:runtime/src/capabilities/base.ts†L1-L26】【F:runtime/src/server/routes/ingress.ts†L69-L120】
- **Disabling stubs** – omit a capability from the request to skip its execution, or remove/comment out the fixture entry in
  `buildCapabilityRegistry` if you want to turn an adapter off globally for a test run. Missing adapters resolve to the
  `DIS_INSUFFICIENT` alias so the audit log still records the refusal deterministically.【F:runtime/src/capabilities/registry.ts†L66-L107】
- **Interpreting refusal codes** – refusal aliases flow through `resolveRefusalCode`, which normalises strings like
  `REFUSAL(BOUND_DEPTH)` and then maps them to manifest-defined codes such as `BOUND_DEPTH` or `BOUND_*`. When an alias is absent,
  the trimmed token is returned so debugging always surfaces a value.【F:runtime/src/shared/refusals.ts†L1-L18】 The manifest’s
  `refusal_aliases` block documents the canonical mappings (for example `TOOL_TIMEOUT → BOUND_TIME`, `TOOL_FAIL → FRAGILITY`).【F:Additionals/Manifest.json†L23-L61】

Audit events summarise the capability results and final termination status – success responses include bounded budgets whereas
refusals capture the alias, resolved code, and diagnostics payload to help trace policy enforcement.【F:runtime/src/server/routes/ingress.ts†L94-L120】【F:runtime/src/server/request-context.ts†L76-L135】 Exec IDs are hashed from the route,
hops, budgets, and payload so identical requests always evaluate to the same identifier, making comparisons across runs
straightforward.【F:runtime/src/server/request-context.ts†L65-L99】【F:runtime/src/services/exec-id.ts†L1-L14】

## Quick-start validation flow

1. **Export configuration**
   ```bash
   export DATABASE_URL="postgresql://localhost:5432/mp_runtime"
   export PORT=3000  # optional override
   ```
2. **Install packages**
   ```bash
   cd runtime
   npm install
   ```
3. **Provision the ledger schema**
   ```bash
   npm run migrate
   ```
4. **Start the ingress API**
   ```bash
   npm run start
   ```
   The service listens on the configured `PORT` and logs each audit frame as requests arrive.【F:runtime/src/index.ts†L12-L24】【F:runtime/src/server/app.ts†L12-L26】
5. **Call an intent with a deterministic capability**
   ```bash
   curl -s http://localhost:${PORT:-3000}/ingress \
     -H 'content-type: application/json' \
     -d '{
           "intent": "legal contract review",
           "capabilities": [
             { "name": "legalSearch", "scenario": "success" }
           ]
         }' | jq
   Adapt the payload/evidence columns if you store the snapshot fields denormalised.
4. **Record migrations** – run the migration before executing the runtime so audit writes succeed. Subsequent schema changes should append new migrations; never mutate history because the ledgers are append-only by design.【F:Education/FLT.md†L30-L78】【F:Additionals/puppy_taxonomy_reference.md†L101-L105】

## 4. Capability adapter modes

The capability registry ships with deterministic stub adapters so you can exercise
tooling flows without reaching external services. Each capability consults an
environment toggle with the pattern `CAPABILITY_<NAME>_MODE` where `<NAME>` is the
uppercased capability identifier (non-alphanumeric characters are converted to `_`).

- `CAPABILITY_LEGAL_SEARCH_MODE`
- `CAPABILITY_COMPLIANCE_SCANNER_MODE`

Supported values are `stub` (default), `disabled`, and `live`. When set to
`disabled`, the registry returns a `DIS_INSUFFICIENT` refusal with the manifest’s
mapped code; `live` requires you to provide a concrete adapter override when
bootstrapping the registry. Future integrations can supply real adapters through
the `buildCapabilityRegistry` options object.【F:runtime/src/capabilities/config.ts†L1-L24】【F:runtime/src/capabilities/registry.ts†L92-L144】

## 5. Placeholder adapter feature flags

The Scholar Essay Writer substrate exposes policy locks that gate “placeholder” adapters for tables and figures. Toggle these flags via your configuration layer before invoking draft routes:

- `ALLOW_TABLE_PLACEHOLDERS` – governs whether drafting steps may emit table placeholders. Turning it off falls back to the adaptation ladder and, if no safe adaptation exists, emits `REFUSAL(OUTPUT_LOCKED)`.【F:Substrates/MPA/Scholar Essay Writer.md†L372-L439】
- `ALLOW_FIGURE_PLACEHOLDERS` – same for figure placeholders. With the flag disabled the system must avoid placeholder emission and refuse if it cannot adapt.【F:Substrates/MPA/Scholar Essay Writer.md†L372-L439】
- `POLICY_PREFER_ADAPT` – keeps adaptation-first behaviour enabled so that draft routes try compliant alternatives before refusing. Ensure this remains true when testing refusal paths so you can observe both adaptive and locked outcomes.【F:Substrates/MPA/Scholar Essay Writer.md†L372-L402】

Quality gates check the relevant `ALLOW_*` settings before generation, so you can reliably test both success and refusal paths by toggling the flags in your manifest or runtime overrides.【F:Substrates/MPA/Scholar Essay Writer.md†L372-L439】

## 6. Generating ExecIDs and verifying ledger entries

1. **ExecID generation** – both the orchestrator and downstream substrates define the ExecID as a deterministic hash over `{input, budgets, route}`. A minimal Node example is:
   ```ts
   import { createHash } from 'crypto';

   function computeExecId(input: unknown, budgets: unknown, route: string) {
     const payload = JSON.stringify({ input, budgets, route });
     return createHash('sha256').update(payload).digest('hex');
   }
   ```
   The response contains a stable `execId`, resolved route, bounded budgets, and an array of capability results. Re-running the
   command emits the same `execId` and audit payload, proving the pipeline’s determinism for the given manifest state.【F:runtime/src/server/routes/ingress.ts†L53-L120】【F:runtime/src/server/request-context.ts†L65-L135】 To test refusal paths, repeat the
   request with `"scenario": "timeout"` (or any other failure mode) and observe the manifest-specific refusal code in the reply
   as well as the audit log entry.【F:runtime/src/capabilities/registry.ts†L20-L107】【F:Additionals/Manifest.json†L49-L60】

Following this sequence ensures every contributor can initialise the database, run the ingress service, and validate both
successful and refusal outcomes locally before promoting capability or manifest changes.

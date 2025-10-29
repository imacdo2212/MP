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
Every orchestration attempt writes a hash-chained audit frame. Configure the ledger connection with `DATABASE_URL`. The service gracefully degrades if the database is unreachable, logging a warning while preserving refusal semantics.

## Exec IDs & determinism
Exec IDs are derived from a hash of the intent, payload, route, and optional `requestId`. Repeating a request with the same inputs produces identical identifiers and audit hashes, aligning with the deterministic guarantees from the manifest.

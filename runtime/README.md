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

## Rumpole legal analysis adapter
Requests routed to `mpa.rumpole` run through a deterministic heuristic that extracts:

- contract summary (first two declarative sentences or a truncated preview),
- likely parties, effective date, and basic document statistics,
- obligations and termination clauses keyed off legal keywords,
- risk flags for indemnification, liability caps, exclusivity, penalties, and missing termination language,
- lightweight question assessments that mark which caller-supplied questions have supporting evidence in the document.

The adapter operates without external APIs, consumes manifest-provided budgets, and annotates responses with `metadata.adapter = "rumpole"` so clients can audit which capability produced the output.

## Audit ledger
Every orchestration attempt writes a hash-chained audit frame. Configure the ledger connection with `DATABASE_URL`. The service gracefully degrades if the database is unreachable, logging a warning while preserving refusal semantics. When a write fails, the HTTP response metadata includes `{ "ledgerWriteFailed": true }` so callers can surface temporary persistence gaps while the runtime remains deterministic.

## Exec IDs & determinism
Exec IDs are derived from a hash of the intent, payload, route, and optional `requestId`. Repeating a request with the same inputs produces identical identifiers and audit hashes, aligning with the deterministic guarantees from the manifest.

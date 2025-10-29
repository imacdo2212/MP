# MP Runtime Developer Guide

This runtime package provides a TypeScript entry point for working with the unified Apex manifest and for exercising compliance guardrails locally. The guide below explains how to prepare your environment, use the available npm scripts, run database migrations for the audit ledger, and validate ExecID plus ledger behaviours during development.

## 1. Environment setup

1. **Install Node.js 20 LTS** – the type definitions pin to the Node 20 API surface, so use a Node 20 toolchain (e.g. `nvm install 20 && nvm use 20`).【F:runtime/package.json†L15-L18】
2. **Install dependencies** – from the repository root run:
   ```bash
   cd runtime
   npm install
   ```
   This pulls the TypeScript, ts-node, and Zod dependencies required by the config loader and demo entry point.【F:runtime/package.json†L6-L17】
3. **Manifest data** – `src/config/manifest.ts` loads `Additionals/Manifest.json` by default. Keep that file in sync with any contract changes, or pass an alternate path into `loadManifestConfig` if you build custom tooling around it.【F:runtime/src/config/manifest.ts†L117-L201】【F:runtime/src/config/manifest.ts†L206-L234】【F:Additionals/Manifest.json†L1-L84】

## 2. Available npm scripts

| Script | Purpose |
| ------ | ------- |
| `npm run start` | Launches the sample runtime that loads the manifest and prints resolved budgets plus routes for a few example intents.【F:runtime/package.json†L6-L9】【F:runtime/src/index.ts†L1-L20】 |
| `npm run build` | Emits compiled JavaScript by running `tsc` against `tsconfig.json` so you can distribute artifacts or run without ts-node.【F:runtime/package.json†L6-L8】 |
| `npm run check` | Type-checks the project without emitting output, useful for CI or pre-commit validation.【F:runtime/package.json†L6-L9】 |

## 3. Database migrations for the audit ledger

The runtime specifications expect append-only, hash-chained ledgers that record planning and compliance artefacts. When bringing up a local environment you can bootstrap a relational table using the schema elements provided in the substrates:

1. **Plan your columns** using the `ledger_template` example – the planning ledger records `event`, a nested `planning_snapshot`, and evidence fields such as `cfu_mean` and `errors_consecutive_max`. Reflect these fields (or JSON blobs containing them) in your table definition.【F:Substrates/MPA/alcuin_reference.json†L400-L459】
2. **Add hash-chain fields** – every ledger record must include `hash` and `prev_hash` columns so you can enforce `prev_hash == prior.hash` during migrations and verification.【F:Substrates/MPA/Rumpole.md†L140-L146】
3. **Migration example** – create a migration in your preferred tool (Prisma, Knex, plain SQL). For PostgreSQL the essential shape is:
   ```sql
   CREATE TABLE audit_ledger (
     id BIGSERIAL PRIMARY KEY,
     session_id TEXT NOT NULL,
     event TEXT NOT NULL,
     payload JSONB NOT NULL,
     evidence JSONB,
     hash TEXT NOT NULL,
     prev_hash TEXT,
     created_at TIMESTAMPTZ DEFAULT now()
   );
   ```
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
   Use this helper in tests to assert that identical calls produce identical ExecIDs.【F:MPA/MPA.md†L39-L44】【F:Substrates/MPA/Scholar Essay Writer.md†L336-L341】
2. **Ledger append verification** – after computing ExecIDs, append audit rows to your ledger service and confirm:
   - The new record’s `prev_hash` equals the previous row’s `hash`, maintaining the hash chain.【F:Substrates/MPA/Rumpole.md†L140-L146】
   - The audit payload captures the planning snapshot/evidence fields described in the templates so downstream reviewers can reconstruct decisions.【F:Substrates/MPA/alcuin_reference.json†L400-L459】
   - Ledger operations remain append-only; do not rewrite prior rows, consistent with the AuditService contract.【F:Education/FLT.md†L30-L78】

With these checks in place you can run `npm run start`, capture emitted audits, and validate both ExecID determinism and ledger continuity before promoting any adapter or manifest changes.

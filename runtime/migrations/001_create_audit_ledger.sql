-- Create the audit_ledger table to store immutable execution records.
-- Each row represents a single runtime execution frame.

CREATE TABLE IF NOT EXISTS audit_ledger (
    id BIGSERIAL PRIMARY KEY,
    exec_id TEXT NOT NULL UNIQUE,
    prev_exec_hash TEXT,
    chain_hash TEXT NOT NULL UNIQUE,
    route TEXT NOT NULL,
    budgets_granted JSONB NOT NULL,
    budgets_used JSONB NOT NULL,
    termination_status TEXT NOT NULL,
    termination_reason TEXT,
    terminated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT audit_ledger_prev_chain_fk FOREIGN KEY (prev_exec_hash)
        REFERENCES audit_ledger (chain_hash)
);

CREATE INDEX IF NOT EXISTS audit_ledger_route_idx ON audit_ledger (route);
CREATE INDEX IF NOT EXISTS audit_ledger_terminated_at_idx ON audit_ledger (terminated_at);

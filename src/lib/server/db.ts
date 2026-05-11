import { Pool } from "pg";

declare global {
  var shadowdaoPgPool: Pool | undefined;
}

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL;

function cleanEnv(value?: string): string | undefined {
  if (!value) return undefined;
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function shouldDisableTlsVerification(): boolean {
  const explicit = cleanEnv(process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED);
  if (explicit) return explicit.toLowerCase() === "false";

  // Default to false for managed dev DBs that commonly use self-signed chains.
  return true;
}

function buildPoolConfig() {
  if (!connectionString) return null;

  const raw = cleanEnv(connectionString)!;
  const url = new URL(raw);
  const sslMode = (url.searchParams.get("sslmode") ?? "").toLowerCase();
  const sslDisabled = cleanEnv(process.env.POSTGRES_SSL)?.toLowerCase() === "false";

  // Preserve protocol, credentials, host, port, and path.
  // `origin` is unreliable for non-HTTP schemes like `postgres://`.
  url.search = "";
  const normalizedConnectionString = url.toString();
  const ssl =
    sslDisabled || sslMode === "disable"
      ? false
      : { rejectUnauthorized: !shouldDisableTlsVerification() };

  return { connectionString: normalizedConnectionString, ssl };
}

export function isDatabaseConfigured() {
  return Boolean(connectionString);
}

export function getPool() {
  if (!connectionString) {
    throw new Error("Postgres is not configured. Set DATABASE_URL or POSTGRES_URL.");
  }

  if (!globalThis.shadowdaoPgPool) {
    const config = buildPoolConfig();
    if (!config) {
      throw new Error("Postgres is not configured. Set DATABASE_URL or POSTGRES_URL.");
    }
    globalThis.shadowdaoPgPool = new Pool(config);
  }

  return globalThis.shadowdaoPgPool;
}

export async function ensureSchema() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shadowdao_proposals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      recipient TEXT NOT NULL,
      requested_amount TEXT NOT NULL DEFAULT 'Confidential',
      amount_raw TEXT NOT NULL,
      mint TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'approved', 'disbursed', 'rejected')),
      votes JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at BIGINT NOT NULL,
      created_by TEXT NOT NULL,
      disbursement_sig TEXT,
      zk_solvency_proof TEXT,
      updated_at BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS shadowdao_proposals_created_at_idx
      ON shadowdao_proposals (created_at DESC);

    CREATE TABLE IF NOT EXISTS shadowdao_streams (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL REFERENCES shadowdao_proposals(id) ON DELETE CASCADE,
      recipient TEXT NOT NULL,
      mint TEXT NOT NULL,
      total_amount_raw TEXT NOT NULL,
      claimed_amount_raw TEXT NOT NULL DEFAULT '0',
      start_at BIGINT NOT NULL,
      cliff_at BIGINT NOT NULL,
      end_at BIGINT NOT NULL,
      cancelled_at BIGINT,
      cancelled_by TEXT,
      status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'completed')),
      created_at BIGINT NOT NULL,
      created_by TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS shadowdao_streams_recipient_created_idx
      ON shadowdao_streams (recipient, created_at DESC);

    CREATE TABLE IF NOT EXISTS shadowdao_stream_claims (
      id TEXT PRIMARY KEY,
      stream_id TEXT NOT NULL REFERENCES shadowdao_streams(id) ON DELETE CASCADE,
      request_id TEXT NOT NULL UNIQUE,
      claimer TEXT NOT NULL,
      amount_raw TEXT NOT NULL,
      tx_signature TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS shadowdao_stream_claims_stream_created_idx
      ON shadowdao_stream_claims (stream_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS shadowdao_panic_policy (
      id TEXT PRIMARY KEY,
      is_armed BOOLEAN NOT NULL DEFAULT FALSE,
      reason TEXT,
      armed_at BIGINT,
      armed_by TEXT,
      disbursements_frozen BOOLEAN NOT NULL DEFAULT TRUE,
      max_stream_duration_ms BIGINT NOT NULL DEFAULT 604800000,
      required_disarm_approvals INTEGER NOT NULL DEFAULT 2,
      safety_recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
      disarm_approvals JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shadowdao_panic_audit_logs (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS shadowdao_panic_audit_logs_created_at_idx
      ON shadowdao_panic_audit_logs (created_at DESC);

    CREATE TABLE IF NOT EXISTS shadowdao_policy_engine (
      id TEXT PRIMARY KEY,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      blocked_jurisdictions JSONB NOT NULL DEFAULT '[]'::jsonb,
      allowed_jurisdictions JSONB NOT NULL DEFAULT '[]'::jsonb,
      max_amount_by_risk JSONB NOT NULL DEFAULT '{"low":"5000000000","medium":"2000000000","high":"500000000"}'::jsonb,
      require_admin_for_high_risk BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shadowdao_recipient_profiles (
      recipient TEXT PRIMARY KEY,
      jurisdiction TEXT NOT NULL,
      risk_level TEXT NOT NULL CHECK (risk_level IN ('low','medium','high')),
      category TEXT NOT NULL DEFAULT 'general',
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shadowdao_policy_audit_logs (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS shadowdao_policy_audit_logs_created_at_idx
      ON shadowdao_policy_audit_logs (created_at DESC);
  `);
}

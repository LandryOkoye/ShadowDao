import { ensureSchema, getPool } from "@/lib/server/db";
import { isValidSolanaAddress } from "@/lib/utils/validation";

type PanicPolicyRow = {
  id: string;
  is_armed: boolean;
  reason: string | null;
  armed_at: string | number | null;
  armed_by: string | null;
  disbursements_frozen: boolean;
  max_stream_duration_ms: string | number;
  required_disarm_approvals: number;
  safety_recipients: string[] | string;
  disarm_approvals: string[] | string;
  updated_at: string | number;
};

type PanicAuditRow = {
  id: string;
  actor: string;
  action: string;
  details: Record<string, unknown> | string;
  created_at: string | number;
};

export type PanicPolicy = {
  isArmed: boolean;
  reason?: string;
  armedAt?: number;
  armedBy?: string;
  disbursementsFrozen: boolean;
  maxStreamDurationMs: number;
  requiredDisarmApprovals: number;
  safetyRecipients: string[];
  disarmApprovals: string[];
  updatedAt: number;
};

export type PanicAuditLog = {
  id: string;
  actor: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: number;
};

function parseStringList(value: string[] | string): string[] {
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: Record<string, unknown> | string): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function toPolicy(row: PanicPolicyRow): PanicPolicy {
  return {
    isArmed: row.is_armed,
    reason: row.reason ?? undefined,
    armedAt: row.armed_at === null ? undefined : Number(row.armed_at),
    armedBy: row.armed_by ?? undefined,
    disbursementsFrozen: row.disbursements_frozen,
    maxStreamDurationMs: Number(row.max_stream_duration_ms),
    requiredDisarmApprovals: Number(row.required_disarm_approvals),
    safetyRecipients: parseStringList(row.safety_recipients),
    disarmApprovals: parseStringList(row.disarm_approvals),
    updatedAt: Number(row.updated_at),
  };
}

function toAuditLog(row: PanicAuditRow): PanicAuditLog {
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    details: parseJsonObject(row.details),
    createdAt: Number(row.created_at),
  };
}

async function appendAudit(actor: string, action: string, details: Record<string, unknown>) {
  const now = Date.now();
  await getPool().query(
    `INSERT INTO shadowdao_panic_audit_logs (id, actor, action, details, created_at)
     VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [crypto.randomUUID(), actor, action, JSON.stringify(details), now]
  );
}

async function ensureDefaultPolicy() {
  await ensureSchema();
  const now = Date.now();
  await getPool().query(
    `INSERT INTO shadowdao_panic_policy (
      id, is_armed, disbursements_frozen, max_stream_duration_ms, required_disarm_approvals,
      safety_recipients, disarm_approvals, updated_at
    ) VALUES ('global', false, true, 604800000, 2, '[]'::jsonb, '[]'::jsonb, $1)
    ON CONFLICT (id) DO NOTHING`,
    [now]
  );
}

export async function getPanicPolicy(): Promise<PanicPolicy> {
  await ensureDefaultPolicy();
  const result = await getPool().query<PanicPolicyRow>(
    "SELECT * FROM shadowdao_panic_policy WHERE id = 'global' LIMIT 1"
  );
  return toPolicy(result.rows[0]);
}

export async function listPanicAuditLogs(limit = 50): Promise<PanicAuditLog[]> {
  await ensureDefaultPolicy();
  const capped = Math.max(1, Math.min(200, limit));
  const result = await getPool().query<PanicAuditRow>(
    "SELECT * FROM shadowdao_panic_audit_logs ORDER BY created_at DESC LIMIT $1",
    [capped]
  );
  return result.rows.map(toAuditLog);
}

export async function armPanicMode(input: {
  actor: string;
  reason?: string;
  disbursementsFrozen?: boolean;
  requiredDisarmApprovals?: number;
  maxStreamDurationMs?: number;
}): Promise<PanicPolicy> {
  if (!isValidSolanaAddress(input.actor)) throw new Error("Actor address is invalid.");
  await ensureDefaultPolicy();
  const current = await getPanicPolicy();
  const now = Date.now();
  const disbursementsFrozen = input.disbursementsFrozen ?? current.disbursementsFrozen;
  const required = input.requiredDisarmApprovals ?? current.requiredDisarmApprovals;
  const maxDuration = input.maxStreamDurationMs ?? current.maxStreamDurationMs;
  if (required < 1) throw new Error("requiredDisarmApprovals must be at least 1.");
  if (maxDuration <= 0) throw new Error("maxStreamDurationMs must be positive.");

  const result = await getPool().query<PanicPolicyRow>(
    `UPDATE shadowdao_panic_policy
     SET is_armed = true,
         reason = $1,
         armed_at = $2,
         armed_by = $3,
         disbursements_frozen = $4,
         required_disarm_approvals = $5,
         max_stream_duration_ms = $6,
         disarm_approvals = '[]'::jsonb,
         updated_at = $2
     WHERE id = 'global'
     RETURNING *`,
    [input.reason?.trim() || null, now, input.actor, disbursementsFrozen, required, maxDuration]
  );
  const cappedEnd = now + maxDuration;
  await getPool().query(
    `UPDATE shadowdao_streams
     SET end_at = LEAST(end_at, $1), cliff_at = LEAST(cliff_at, $1), updated_at = $2
     WHERE status = 'active'`,
    [cappedEnd, now]
  );
  await appendAudit(input.actor, "panic_arm", {
    reason: input.reason ?? null,
    disbursementsFrozen,
    requiredDisarmApprovals: required,
    maxStreamDurationMs: maxDuration,
  });
  return toPolicy(result.rows[0]);
}

export async function approveDisarm(actor: string): Promise<PanicPolicy> {
  if (!isValidSolanaAddress(actor)) throw new Error("Actor address is invalid.");
  await ensureDefaultPolicy();
  const current = await getPanicPolicy();
  if (!current.isArmed) throw new Error("Panic mode is not armed.");
  const approvals = Array.from(new Set([...current.disarmApprovals, actor]));

  const result = await getPool().query<PanicPolicyRow>(
    `UPDATE shadowdao_panic_policy
     SET disarm_approvals = $1::jsonb, updated_at = $2
     WHERE id = 'global'
     RETURNING *`,
    [JSON.stringify(approvals), Date.now()]
  );
  await appendAudit(actor, "panic_disarm_approval", { approvalsCount: approvals.length });
  return toPolicy(result.rows[0]);
}

export async function disarmPanicMode(actor: string): Promise<PanicPolicy> {
  if (!isValidSolanaAddress(actor)) throw new Error("Actor address is invalid.");
  await ensureDefaultPolicy();
  const current = await getPanicPolicy();
  if (!current.isArmed) throw new Error("Panic mode is not armed.");

  const approvals = Array.from(new Set([...current.disarmApprovals, actor]));
  if (approvals.length < current.requiredDisarmApprovals) {
    throw new Error(
      `Disarm requires ${current.requiredDisarmApprovals} approvals. Current: ${approvals.length}.`
    );
  }

  const now = Date.now();
  const result = await getPool().query<PanicPolicyRow>(
    `UPDATE shadowdao_panic_policy
     SET is_armed = false,
         reason = NULL,
         armed_at = NULL,
         armed_by = NULL,
         disarm_approvals = '[]'::jsonb,
         updated_at = $1
     WHERE id = 'global'
     RETURNING *`,
    [now]
  );
  await appendAudit(actor, "panic_disarm", { approvedBy: approvals, required: current.requiredDisarmApprovals });
  return toPolicy(result.rows[0]);
}

export async function addSafetyRecipient(actor: string, recipient: string): Promise<PanicPolicy> {
  if (!isValidSolanaAddress(actor)) throw new Error("Actor address is invalid.");
  if (!isValidSolanaAddress(recipient)) throw new Error("Recipient address is invalid.");
  await ensureDefaultPolicy();
  const current = await getPanicPolicy();
  const next = Array.from(new Set([...current.safetyRecipients, recipient]));
  const result = await getPool().query<PanicPolicyRow>(
    `UPDATE shadowdao_panic_policy
     SET safety_recipients = $1::jsonb, updated_at = $2
     WHERE id = 'global'
     RETURNING *`,
    [JSON.stringify(next), Date.now()]
  );
  await appendAudit(actor, "panic_add_safety_recipient", { recipient });
  return toPolicy(result.rows[0]);
}

export async function removeSafetyRecipient(actor: string, recipient: string): Promise<PanicPolicy> {
  if (!isValidSolanaAddress(actor)) throw new Error("Actor address is invalid.");
  if (!isValidSolanaAddress(recipient)) throw new Error("Recipient address is invalid.");
  await ensureDefaultPolicy();
  const current = await getPanicPolicy();
  const next = current.safetyRecipients.filter((item) => item !== recipient);
  const result = await getPool().query<PanicPolicyRow>(
    `UPDATE shadowdao_panic_policy
     SET safety_recipients = $1::jsonb, updated_at = $2
     WHERE id = 'global'
     RETURNING *`,
    [JSON.stringify(next), Date.now()]
  );
  await appendAudit(actor, "panic_remove_safety_recipient", { recipient });
  return toPolicy(result.rows[0]);
}

export function assertRecipientAllowedInPanic(policy: PanicPolicy, recipient: string) {
  if (!policy.isArmed) return;
  if (policy.safetyRecipients.includes(recipient)) return;
  throw new Error("Panic mode is active: recipient is not on the safety allowlist.");
}

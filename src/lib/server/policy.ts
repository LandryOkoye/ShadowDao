import { ensureSchema, getPool } from "@/lib/server/db";
import { ADMIN_ADDRESSES } from "@/lib/utils/constants";
import { isValidSolanaAddress } from "@/lib/utils/validation";

type RiskLevel = "low" | "medium" | "high";
type PolicyAction =
  | "proposal_create"
  | "proposal_approve"
  | "proposal_disburse"
  | "stream_create";

type PolicyRow = {
  id: string;
  is_enabled: boolean;
  blocked_jurisdictions: string[] | string;
  allowed_jurisdictions: string[] | string;
  max_amount_by_risk: Record<string, string> | string;
  require_admin_for_high_risk: boolean;
  updated_at: string | number;
};

type RecipientProfileRow = {
  recipient: string;
  jurisdiction: string;
  risk_level: RiskLevel;
  category: string;
  updated_at: string | number;
};

type PolicyAuditRow = {
  id: string;
  actor: string;
  action: string;
  details: Record<string, unknown> | string;
  created_at: string | number;
};

export type PolicyEngineConfig = {
  isEnabled: boolean;
  blockedJurisdictions: string[];
  allowedJurisdictions: string[];
  maxAmountByRisk: Record<RiskLevel, bigint>;
  requireAdminForHighRisk: boolean;
  updatedAt: number;
};

export type RecipientProfile = {
  recipient: string;
  jurisdiction: string;
  riskLevel: RiskLevel;
  category: string;
  updatedAt: number;
};

export type PolicyAuditLog = {
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

function parseRiskCaps(value: Record<string, string> | string): Record<RiskLevel, bigint> {
  const fallback: Record<RiskLevel, bigint> = {
    low: 5_000_000_000n,
    medium: 2_000_000_000n,
    high: 500_000_000n,
  };
  let parsed: Record<string, string> = {};
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as Record<string, string>;
    } catch {
      return fallback;
    }
  } else {
    parsed = value;
  }
  return {
    low: parsed.low ? BigInt(parsed.low) : fallback.low,
    medium: parsed.medium ? BigInt(parsed.medium) : fallback.medium,
    high: parsed.high ? BigInt(parsed.high) : fallback.high,
  };
}

function toPolicy(row: PolicyRow): PolicyEngineConfig {
  return {
    isEnabled: row.is_enabled,
    blockedJurisdictions: parseStringList(row.blocked_jurisdictions),
    allowedJurisdictions: parseStringList(row.allowed_jurisdictions),
    maxAmountByRisk: parseRiskCaps(row.max_amount_by_risk),
    requireAdminForHighRisk: row.require_admin_for_high_risk,
    updatedAt: Number(row.updated_at),
  };
}

function toRecipientProfile(row: RecipientProfileRow): RecipientProfile {
  return {
    recipient: row.recipient,
    jurisdiction: row.jurisdiction,
    riskLevel: row.risk_level,
    category: row.category,
    updatedAt: Number(row.updated_at),
  };
}

function toPolicyAudit(row: PolicyAuditRow): PolicyAuditLog {
  let details: Record<string, unknown> = {};
  if (row.details && typeof row.details === "object" && !Array.isArray(row.details)) {
    details = row.details;
  } else {
    try {
      const parsed = JSON.parse(String(row.details));
      details = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      details = {};
    }
  }
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    details,
    createdAt: Number(row.created_at),
  };
}

function isAdmin(actor?: string): boolean {
  if (!actor) return false;
  return ADMIN_ADDRESSES.includes(actor);
}

async function appendPolicyAudit(actor: string, action: string, details: Record<string, unknown>) {
  await getPool().query(
    `INSERT INTO shadowdao_policy_audit_logs (id, actor, action, details, created_at)
     VALUES ($1, $2, $3, $4::jsonb, $5)`,
    [crypto.randomUUID(), actor, action, JSON.stringify(details), Date.now()]
  );
}

async function ensureDefaultPolicy() {
  await ensureSchema();
  await getPool().query(
    `INSERT INTO shadowdao_policy_engine (
      id, is_enabled, blocked_jurisdictions, allowed_jurisdictions, max_amount_by_risk, require_admin_for_high_risk, updated_at
    ) VALUES (
      'global', true, '[]'::jsonb, '[]'::jsonb, '{"low":"5000000000","medium":"2000000000","high":"500000000"}'::jsonb, true, $1
    )
    ON CONFLICT (id) DO NOTHING`,
    [Date.now()]
  );
}

export async function getPolicyEngine(): Promise<PolicyEngineConfig> {
  await ensureDefaultPolicy();
  const result = await getPool().query<PolicyRow>(
    "SELECT * FROM shadowdao_policy_engine WHERE id = 'global' LIMIT 1"
  );
  return toPolicy(result.rows[0]);
}

export async function updatePolicyEngine(input: {
  actor: string;
  isEnabled?: boolean;
  blockedJurisdictions?: string[];
  allowedJurisdictions?: string[];
  maxAmountByRisk?: Partial<Record<RiskLevel, string>>;
  requireAdminForHighRisk?: boolean;
}): Promise<PolicyEngineConfig> {
  if (!isValidSolanaAddress(input.actor)) throw new Error("Actor address is invalid.");
  if (!isAdmin(input.actor)) throw new Error("Only admin wallets can update policy settings.");

  await ensureDefaultPolicy();
  const current = await getPolicyEngine();
  const nextRiskCaps = {
    ...current.maxAmountByRisk,
    ...(input.maxAmountByRisk
      ? {
          low: input.maxAmountByRisk.low ? BigInt(input.maxAmountByRisk.low) : current.maxAmountByRisk.low,
          medium: input.maxAmountByRisk.medium ? BigInt(input.maxAmountByRisk.medium) : current.maxAmountByRisk.medium,
          high: input.maxAmountByRisk.high ? BigInt(input.maxAmountByRisk.high) : current.maxAmountByRisk.high,
        }
      : {}),
  };

  const now = Date.now();
  const result = await getPool().query<PolicyRow>(
    `UPDATE shadowdao_policy_engine
     SET is_enabled = $1,
         blocked_jurisdictions = $2::jsonb,
         allowed_jurisdictions = $3::jsonb,
         max_amount_by_risk = $4::jsonb,
         require_admin_for_high_risk = $5,
         updated_at = $6
     WHERE id = 'global'
     RETURNING *`,
    [
      input.isEnabled ?? current.isEnabled,
      JSON.stringify(input.blockedJurisdictions ?? current.blockedJurisdictions),
      JSON.stringify(input.allowedJurisdictions ?? current.allowedJurisdictions),
      JSON.stringify({
        low: nextRiskCaps.low.toString(),
        medium: nextRiskCaps.medium.toString(),
        high: nextRiskCaps.high.toString(),
      }),
      input.requireAdminForHighRisk ?? current.requireAdminForHighRisk,
      now,
    ]
  );
  await appendPolicyAudit(input.actor, "policy_update", {
    isEnabled: input.isEnabled ?? current.isEnabled,
    requireAdminForHighRisk: input.requireAdminForHighRisk ?? current.requireAdminForHighRisk,
  });
  return toPolicy(result.rows[0]);
}

export async function upsertRecipientProfile(input: {
  actor: string;
  recipient: string;
  jurisdiction: string;
  riskLevel: RiskLevel;
  category?: string;
}): Promise<RecipientProfile> {
  if (!isValidSolanaAddress(input.actor)) throw new Error("Actor address is invalid.");
  if (!isAdmin(input.actor)) throw new Error("Only admin wallets can manage recipient profiles.");
  if (!isValidSolanaAddress(input.recipient)) throw new Error("Recipient address is invalid.");
  if (!input.jurisdiction.trim()) throw new Error("Jurisdiction is required.");

  await ensureDefaultPolicy();
  const now = Date.now();
  const result = await getPool().query<RecipientProfileRow>(
    `INSERT INTO shadowdao_recipient_profiles (recipient, jurisdiction, risk_level, category, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (recipient) DO UPDATE
     SET jurisdiction = EXCLUDED.jurisdiction,
         risk_level = EXCLUDED.risk_level,
         category = EXCLUDED.category,
         updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [input.recipient, input.jurisdiction.trim().toUpperCase(), input.riskLevel, input.category?.trim() || "general", now]
  );
  await appendPolicyAudit(input.actor, "recipient_profile_upsert", {
    recipient: input.recipient,
    jurisdiction: input.jurisdiction.trim().toUpperCase(),
    riskLevel: input.riskLevel,
  });
  return toRecipientProfile(result.rows[0]);
}

export async function listRecipientProfiles(): Promise<RecipientProfile[]> {
  await ensureDefaultPolicy();
  const result = await getPool().query<RecipientProfileRow>(
    "SELECT * FROM shadowdao_recipient_profiles ORDER BY updated_at DESC"
  );
  return result.rows.map(toRecipientProfile);
}

export async function getRecipientProfile(recipient: string): Promise<RecipientProfile | null> {
  await ensureDefaultPolicy();
  const result = await getPool().query<RecipientProfileRow>(
    "SELECT * FROM shadowdao_recipient_profiles WHERE recipient = $1 LIMIT 1",
    [recipient]
  );
  return result.rows[0] ? toRecipientProfile(result.rows[0]) : null;
}

export async function listPolicyAudits(limit = 60): Promise<PolicyAuditLog[]> {
  await ensureDefaultPolicy();
  const capped = Math.max(1, Math.min(limit, 200));
  const result = await getPool().query<PolicyAuditRow>(
    "SELECT * FROM shadowdao_policy_audit_logs ORDER BY created_at DESC LIMIT $1",
    [capped]
  );
  return result.rows.map(toPolicyAudit);
}

export async function enforcePolicyOrThrow(input: {
  action: PolicyAction;
  recipient: string;
  amountRaw: bigint;
  actor?: string;
}) {
  const policy = await getPolicyEngine();
  if (!policy.isEnabled) return;

  const profile = await getRecipientProfile(input.recipient);
  if (!profile) {
    throw new Error("Policy engine: recipient profile is missing. Configure jurisdiction/risk before proceeding.");
  }

  const jurisdiction = profile.jurisdiction.toUpperCase();
  const blocked = policy.blockedJurisdictions.map((j) => j.toUpperCase());
  const allowed = policy.allowedJurisdictions.map((j) => j.toUpperCase());
  if (blocked.includes(jurisdiction)) {
    throw new Error(`Policy engine blocked jurisdiction: ${jurisdiction}.`);
  }
  if (allowed.length > 0 && !allowed.includes(jurisdiction)) {
    throw new Error(`Policy engine: jurisdiction ${jurisdiction} is not on the allowlist.`);
  }

  const cap = policy.maxAmountByRisk[profile.riskLevel];
  if (input.amountRaw > cap) {
    throw new Error(
      `Policy engine: amount exceeds ${profile.riskLevel} risk cap (${cap.toString()} raw units).`
    );
  }

  if (
    policy.requireAdminForHighRisk &&
    profile.riskLevel === "high" &&
    (input.action === "proposal_approve" || input.action === "proposal_disburse" || input.action === "stream_create")
  ) {
    if (!isAdmin(input.actor)) {
      throw new Error("Policy engine: high-risk recipient actions require an admin wallet.");
    }
  }
}


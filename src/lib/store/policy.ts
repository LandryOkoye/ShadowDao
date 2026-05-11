export type RiskLevel = "low" | "medium" | "high";

export type PolicyEngineConfig = {
  isEnabled: boolean;
  blockedJurisdictions: string[];
  allowedJurisdictions: string[];
  maxAmountByRisk: Record<RiskLevel, string>;
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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "Policy request failed.");
  return payload as T;
}

function normalizePolicy(raw: Omit<PolicyEngineConfig, "maxAmountByRisk"> & { maxAmountByRisk: Record<RiskLevel, string | number | bigint> }): PolicyEngineConfig {
  return {
    ...raw,
    maxAmountByRisk: {
      low: String(raw.maxAmountByRisk.low),
      medium: String(raw.maxAmountByRisk.medium),
      high: String(raw.maxAmountByRisk.high),
    },
  };
}

export async function getPolicyState(limit = 60): Promise<{
  policy: PolicyEngineConfig;
  recipients: RecipientProfile[];
  audits: PolicyAuditLog[];
}> {
  const payload = await request<{
    policy: Omit<PolicyEngineConfig, "maxAmountByRisk"> & { maxAmountByRisk: Record<RiskLevel, string | number | bigint> };
    recipients: RecipientProfile[];
    audits: PolicyAuditLog[];
  }>(`/api/policy?limit=${limit}`);
  return {
    policy: normalizePolicy(payload.policy),
    recipients: payload.recipients,
    audits: payload.audits,
  };
}

export async function updatePolicy(input: {
  actor: string;
  isEnabled?: boolean;
  blockedJurisdictions?: string[];
  allowedJurisdictions?: string[];
  maxAmountByRisk?: Partial<Record<RiskLevel, string>>;
  requireAdminForHighRisk?: boolean;
}): Promise<PolicyEngineConfig> {
  const payload = await request<{ policy: Omit<PolicyEngineConfig, "maxAmountByRisk"> & { maxAmountByRisk: Record<RiskLevel, string | number | bigint> } }>(
    "/api/policy",
    {
      method: "POST",
      body: JSON.stringify({
        action: "update_policy",
        ...input,
      }),
    }
  );
  return normalizePolicy(payload.policy);
}

export async function upsertRecipientProfile(input: {
  actor: string;
  recipient: string;
  jurisdiction: string;
  riskLevel: RiskLevel;
  category?: string;
}): Promise<RecipientProfile> {
  const payload = await request<{ profile: RecipientProfile }>("/api/policy", {
    method: "POST",
    body: JSON.stringify({
      action: "upsert_recipient_profile",
      ...input,
    }),
  });
  return payload.profile;
}


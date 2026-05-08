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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "Panic request failed.");
  return payload as T;
}

export async function getPanicState(limit = 50): Promise<{ policy: PanicPolicy; logs: PanicAuditLog[] }> {
  return request<{ policy: PanicPolicy; logs: PanicAuditLog[] }>(`/api/panic?limit=${limit}`);
}

export async function panicAction(input: Record<string, unknown>) {
  const payload = await request<{ policy: PanicPolicy }>("/api/panic", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.policy;
}


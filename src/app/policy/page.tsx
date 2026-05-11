"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield, Settings, UserPlus } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Badge, Button, Card, Input } from "@/components/ui/primitives";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/components/ui/Toast";
import { ADMIN_ADDRESSES } from "@/lib/utils/constants";
import {
  getPolicyState,
  updatePolicy,
  upsertRecipientProfile,
  type PolicyAuditLog,
  type PolicyEngineConfig,
  type RecipientProfile,
  type RiskLevel,
} from "@/lib/store/policy";

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

export default function PolicyPage() {
  const wallet = useWallet();
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<PolicyEngineConfig | null>(null);
  const [profiles, setProfiles] = useState<RecipientProfile[]>([]);
  const [audits, setAudits] = useState<PolicyAuditLog[]>([]);

  const [blocked, setBlocked] = useState("");
  const [allowed, setAllowed] = useState("");
  const [lowCap, setLowCap] = useState("");
  const [mediumCap, setMediumCap] = useState("");
  const [highCap, setHighCap] = useState("");
  const [requireAdminHighRisk, setRequireAdminHighRisk] = useState(true);
  const [isEnabled, setIsEnabled] = useState(true);

  const [recipient, setRecipient] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("medium");
  const [category, setCategory] = useState("general");

  const address = wallet.publicKey?.toBase58() ?? "";
  const isAdmin = ADMIN_ADDRESSES.includes(address);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const state = await getPolicyState();
      setPolicy(state.policy);
      setProfiles(state.recipients);
      setAudits(state.audits);
      setBlocked(state.policy.blockedJurisdictions.join(", "));
      setAllowed(state.policy.allowedJurisdictions.join(", "));
      setLowCap(state.policy.maxAmountByRisk.low);
      setMediumCap(state.policy.maxAmountByRisk.medium);
      setHighCap(state.policy.maxAmountByRisk.high);
      setRequireAdminHighRisk(state.policy.requireAdminForHighRisk);
      setIsEnabled(state.policy.isEnabled);
    } catch (e) {
      error("Failed to load policy state", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const savePolicy = async () => {
    if (!address) {
      error("Wallet not connected");
      return;
    }
    setSaving(true);
    try {
      await updatePolicy({
        actor: address,
        isEnabled,
        blockedJurisdictions: parseList(blocked),
        allowedJurisdictions: parseList(allowed),
        maxAmountByRisk: {
          low: lowCap,
          medium: mediumCap,
          high: highCap,
        },
        requireAdminForHighRisk: requireAdminHighRisk,
      });
      await load();
      success("Policy updated");
    } catch (e) {
      error("Failed to update policy", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    if (!address) {
      error("Wallet not connected");
      return;
    }
    setSaving(true);
    try {
      await upsertRecipientProfile({
        actor: address,
        recipient,
        jurisdiction,
        riskLevel,
        category,
      });
      setRecipient("");
      setJurisdiction("");
      setRiskLevel("medium");
      setCategory("general");
      await load();
      success("Recipient profile saved");
    } catch (e) {
      error("Failed to save profile", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Shield size={24} style={{ color: "var(--accent-violet)" }} />
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700 }}>Policy Engine</h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Jurisdiction-aware controls for proposal, disbursement, and stream execution.
            </p>
          </div>
        </div>

        {!isAdmin ? (
          <Card>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Only admin wallets can edit policy. Add your wallet to `NEXT_PUBLIC_ADMIN_ADDRESSES`.
            </p>
          </Card>
        ) : loading || !policy ? (
          <Card>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Loading policy settings...</p>
          </Card>
        ) : (
          <>
            <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Settings size={16} />
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Global Rules</h2>
                <Badge variant={isEnabled ? "teal" : "gray"} dot>{isEnabled ? "Enabled" : "Disabled"}</Badge>
              </div>

              <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
                Enable policy enforcement
              </label>
              <label style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={requireAdminHighRisk} onChange={(e) => setRequireAdminHighRisk(e.target.checked)} />
                Require admin for high-risk approve/disburse/stream actions
              </label>

              <Input label="Blocked jurisdictions (comma-separated ISO codes)" value={blocked} onChange={(e) => setBlocked(e.target.value)} />
              <Input label="Allowed jurisdictions (empty means allow all non-blocked)" value={allowed} onChange={(e) => setAllowed(e.target.value)} />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                <Input label="Low risk max raw amount" value={lowCap} onChange={(e) => setLowCap(e.target.value)} />
                <Input label="Medium risk max raw amount" value={mediumCap} onChange={(e) => setMediumCap(e.target.value)} />
                <Input label="High risk max raw amount" value={highCap} onChange={(e) => setHighCap(e.target.value)} />
              </div>

              <Button variant="primary" loading={saving} onClick={savePolicy}>Save Policy Rules</Button>
            </Card>

            <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <UserPlus size={16} />
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Recipient Profiles</h2>
              </div>
              <Input label="Recipient Wallet" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
              <Input label="Jurisdiction (ISO code e.g. NG, US, DE)" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value.toUpperCase())} />
              <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
              <div style={{ display: "flex", gap: 8 }}>
                {(["low", "medium", "high"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRiskLevel(r)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-subtle)",
                      background: riskLevel === r ? "rgba(59,130,246,0.2)" : "var(--bg-elevated)",
                      color: riskLevel === r ? "var(--text-primary)" : "var(--text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    {r.toUpperCase()}
                  </button>
                ))}
              </div>
              <Button variant="secondary" loading={saving} onClick={saveProfile}>Save Recipient Profile</Button>

              <div style={{ display: "grid", gap: 8 }}>
                {profiles.map((profile) => (
                  <div key={profile.recipient} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                    <p style={{ fontSize: 12, fontWeight: 600 }}>{profile.recipient}</p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {profile.jurisdiction} · {profile.riskLevel.toUpperCase()} · {profile.category}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Policy Audit</h2>
              {audits.map((audit) => (
                <div key={audit.id} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                  <p style={{ fontSize: 12, fontWeight: 600 }}>{audit.action}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {new Date(audit.createdAt).toLocaleString()} · {audit.actor.slice(0, 6)}...{audit.actor.slice(-4)}
                  </p>
                </div>
              ))}
            </Card>
          </>
        )}
      </motion.div>
    </AppShell>
  );
}


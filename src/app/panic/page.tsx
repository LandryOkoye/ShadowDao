"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Shield, UserPlus, UserMinus, CheckCircle2 } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Badge, Button, Card, Input } from "@/components/ui/primitives";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/components/ui/Toast";
import { getPanicState, panicAction, type PanicAuditLog, type PanicPolicy } from "@/lib/store/panic";
import { ADMIN_ADDRESSES } from "@/lib/utils/constants";

export default function PanicPage() {
  const wallet = useWallet();
  const { success, error } = useToast();
  const [policy, setPolicy] = useState<PanicPolicy | null>(null);
  const [logs, setLogs] = useState<PanicAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState("Emergency response mode");
  const [durationDays, setDurationDays] = useState("7");
  const [requiredApprovals, setRequiredApprovals] = useState("2");
  const [candidateRecipient, setCandidateRecipient] = useState("");

  const address = wallet.publicKey?.toBase58() ?? "";
  const isAdmin = ADMIN_ADDRESSES.includes(address);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const state = await getPanicState(30);
      setPolicy(state.policy);
      setLogs(state.logs);
    } catch (e) {
      error("Failed to load panic controls", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const run = async (key: string, body: Record<string, unknown>) => {
    if (!address) {
      error("Wallet not connected");
      return;
    }
    setBusy(key);
    try {
      await panicAction({ ...body, actor: address });
      await load();
      success("Panic policy updated");
    } catch (e) {
      error("Panic action failed", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={24} style={{ color: "var(--warning)" }} />
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700 }}>Panic Treasury Mode</h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Emergency controls for disbursement restrictions, stream caps, and multi-party recovery.
            </p>
          </div>
        </div>

        {!address ? (
          <Card><p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Connect wallet to use panic controls.</p></Card>
        ) : loading || !policy ? (
          <Card><p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Loading panic policy...</p></Card>
        ) : (
          <>
            <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <Badge variant={policy.isArmed ? "yellow" : "green"} dot>
                  {policy.isArmed ? "PANIC MODE ARMED" : "NORMAL OPERATIONS"}
                </Badge>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Disarm approvals: {policy.disarmApprovals.length}/{policy.requiredDisarmApprovals}
                </p>
              </div>

              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Reason: {policy.reason ?? "Not set"} · Max stream duration in panic: {Math.round(policy.maxStreamDurationMs / (24 * 60 * 60 * 1000))} day(s)
              </p>

              {isAdmin && (
                <>
                  <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Input label="Max stream days in panic" type="number" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
                    <Input label="Required disarm approvals" type="number" value={requiredApprovals} onChange={(e) => setRequiredApprovals(e.target.value)} />
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button
                  variant="danger"
                  icon={<Shield size={14} />}
                  loading={busy === "arm"}
                  disabled={!isAdmin || policy.isArmed}
                  onClick={() =>
                    void run("arm", {
                      action: "arm",
                      reason,
                      disbursementsFrozen: true,
                      maxStreamDurationMs: Math.max(1, Number(durationDays)) * 24 * 60 * 60 * 1000,
                      requiredDisarmApprovals: Math.max(1, Number(requiredApprovals)),
                    })
                  }
                >
                  Arm Panic Mode
                </Button>
                <Button
                  variant="secondary"
                  icon={<CheckCircle2 size={14} />}
                  loading={busy === "approve_disarm"}
                  disabled={!policy.isArmed}
                  onClick={() => void run("approve_disarm", { action: "approve_disarm" })}
                >
                  Approve Disarm
                </Button>
                <Button
                  variant="teal"
                  loading={busy === "disarm"}
                  disabled={!policy.isArmed}
                  onClick={() => void run("disarm", { action: "disarm" })}
                >
                  Disarm
                </Button>
              </div>
            </Card>

            <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Safety Recipients</h2>
              <div style={{ display: "flex", gap: 10 }}>
                <Input
                  label="Wallet Address"
                  value={candidateRecipient}
                  onChange={(e) => setCandidateRecipient(e.target.value)}
                  placeholder="Recipient allowlist address"
                />
                <Button
                  variant="secondary"
                  icon={<UserPlus size={14} />}
                  loading={busy === "add_safety"}
                  disabled={!isAdmin || !candidateRecipient.trim()}
                  onClick={() => void run("add_safety", { action: "add_safety_recipient", recipient: candidateRecipient.trim() })}
                >
                  Add
                </Button>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {policy.safetyRecipients.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No safety recipients configured.</p>
                ) : (
                  policy.safetyRecipients.map((recipient) => (
                    <div key={recipient} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                      <code style={{ fontSize: 12 }}>{recipient}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<UserMinus size={14} />}
                        loading={busy === `remove-${recipient}`}
                        disabled={!isAdmin}
                        onClick={() => void run(`remove-${recipient}`, { action: "remove_safety_recipient", recipient })}
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Audit Trail</h2>
              <div style={{ display: "grid", gap: 6 }}>
                {logs.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No panic audit logs yet.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                      <p style={{ fontSize: 12, fontWeight: 600 }}>{log.action}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {new Date(log.createdAt).toLocaleString()} · {log.actor.slice(0, 6)}...{log.actor.slice(-4)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </>
        )}
      </motion.div>
    </AppShell>
  );
}


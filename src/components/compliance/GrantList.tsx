"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldOff, ExternalLink, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";
import { revokeViewingAccess, checkGrantStatus } from "@/lib/umbra/compliance";
import { useUmbra } from "@/contexts/UmbraContext";
import { useToast } from "@/components/ui/Toast";
import type { Address } from "@solana/addresses";

interface GrantRecord {
  receiver: string;
  receiverX25519: string;
  granterX25519: string;
  nonce: string;
  txSig?: string;
  grantedAt: number;
  status?: "active" | "revoked" | "checking";
}

interface Props {
  grants: GrantRecord[];
  onUpdate: (grants: GrantRecord[]) => void;
}

export function GrantList({ grants, onUpdate }: Props) {
  const { client } = useUmbra();
  const { success, error, info } = useToast();
  const [revoking, setRevoking] = useState<string | null>(null);

  const handleRevoke = async (grant: GrantRecord) => {
    if (!client) { error("Client not initialised"); return; }
    setRevoking(grant.nonce);
    try {
      info("Revoking grant…", "Submitting revocation transaction.");
      await revokeViewingAccess(client, grant.receiver as Address, grant.granterX25519, grant.receiverX25519, grant.nonce);
      success("Grant revoked", "Auditor access has been removed on-chain.");
      onUpdate(grants.map(g => g.nonce === grant.nonce ? { ...g, status: "revoked" } : g));
    } catch (e) {
      error("Revoke failed", String(e));
    } finally {
      setRevoking(null);
    }
  };

  const handleCheck = async (grant: GrantRecord) => {
    if (!client) return;
    onUpdate(grants.map(g => g.nonce === grant.nonce ? { ...g, status: "checking" } : g));
    try {
      const result = await checkGrantStatus(client, grant.granterX25519, grant.nonce, grant.receiverX25519);
      const isActive = (result as { state?: string })?.state === "exists";
      onUpdate(grants.map(g => g.nonce === grant.nonce ? { ...g, status: isActive ? "active" : "revoked" } : g));
    } catch {
      onUpdate(grants.map(g => g.nonce === grant.nonce ? { ...g, status: "active" } : g));
    }
  };

  if (grants.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
        <ShieldOff size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
        <p style={{ fontSize: 14 }}>No compliance grants issued yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <AnimatePresence>
        {grants.map((grant) => (
          <motion.div
            key={grant.nonce}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            {/* Status icon */}
            {grant.status === "active" && <CheckCircle size={18} style={{ color: "var(--success)", flexShrink: 0 }} />}
            {grant.status === "revoked" && <XCircle size={18} style={{ color: "var(--error)", flexShrink: 0 }} />}
            {grant.status === "checking" && <Clock size={18} style={{ color: "var(--warning)", flexShrink: 0 }} />}
            {!grant.status && <CheckCircle size={18} style={{ color: "var(--accent-teal)", flexShrink: 0 }} />}

            {/* Info */}
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                {grant.receiver.slice(0, 8)}…{grant.receiver.slice(-6)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Nonce: {grant.nonce} · {new Date(grant.grantedAt).toLocaleString()}
              </div>
            </div>

            {/* Badge */}
            <Badge variant={grant.status === "revoked" ? "red" : "green"} dot={grant.status !== "revoked"}>
              {grant.status === "revoked" ? "Revoked" : grant.status === "checking" ? "Checking…" : "Active"}
            </Badge>

            {/* Tx link */}
            {grant.txSig && (
              <a href={`https://explorer.solana.com/tx/${grant.txSig}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--accent-teal)", display: "flex", alignItems: "center", gap: 4, fontSize: 12, textDecoration: "none" }}>
                <ExternalLink size={12} /> Tx
              </a>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={() => handleCheck(grant)}>Check</Button>
              {grant.status !== "revoked" && (
                <Button variant="danger" size="sm" icon={<ShieldOff size={14} />}
                  loading={revoking === grant.nonce}
                  onClick={() => handleRevoke(grant)}>
                  Revoke
                </Button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

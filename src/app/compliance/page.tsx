"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, History } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card } from "@/components/ui/primitives";
import { GrantForm } from "@/components/compliance/GrantForm";
import { GrantList } from "@/components/compliance/GrantList";
import { useWallet } from "@solana/wallet-adapter-react";

export interface GrantRecord {
  receiver: string;
  receiverX25519: string;
  granterX25519: string;
  nonce: string;
  txSig?: string;
  grantedAt: number;
  status?: "active" | "revoked" | "checking";
}

const STORAGE_KEY = "shadowdao_grants";

function loadGrants(): GrantRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GrantRecord[]) : [];
  } catch {
    return [];
  }
}

function saveGrants(grants: GrantRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(grants));
}

export default function CompliancePage() {
  const wallet = useWallet();
  const [grants, setGrants] = useState<GrantRecord[]>(() => loadGrants());

  // Persist whenever grants change
  const updateGrants = useCallback((next: GrantRecord[]) => {
    setGrants(next);
    saveGrants(next);
  }, []);

  const handleGranted = useCallback((record: GrantRecord) => {
    setGrants((prev) => {
      const next = [{ ...record, status: "active" as const }, ...prev];
      saveGrants(next);
      return next;
    });
  }, []);

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {/* Header */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <ShieldCheck size={28} style={{ color: "var(--accent-teal)" }} />
            <h1 style={{ fontSize: 26, fontWeight: 700 }}>Compliance</h1>
          </div>
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Grant auditors time-boxed viewing key access to your transaction history. Revoke at any time.
          </p>
        </div>

        {/* How it works */}
        <Card style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[
            { step: "01", title: "Issue Grant",   desc: "Provide auditor address + X25519 keys. One on-chain tx grants viewing access." },
            { step: "02", title: "Check Status",  desc: "Query on-chain whether a compliance grant is currently active or revoked." },
            { step: "03", title: "Revoke Access", desc: "A single transaction permanently removes auditor access — no re-grant possible with same nonce." },
          ].map(item => (
            <div key={item.step} style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: "var(--accent-violet)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>
                STEP {item.step}
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{item.title}</p>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{item.desc}</p>
            </div>
          ))}
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {/* Grant form */}
          <div>
            {wallet.connected ? (
              <GrantForm onGranted={handleGranted} />
            ) : (
              <Card style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                Connect wallet to issue compliance grants.
              </Card>
            )}
          </div>

          {/* Grant list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <History size={18} style={{ color: "var(--text-muted)" }} />
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Active Grants</h2>
            </div>
            <GrantList grants={grants} onUpdate={updateGrants} />
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}

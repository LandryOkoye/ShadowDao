"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Vault, Download, ScanLine, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { Card, Button, Badge } from "@/components/ui/primitives";
import { PrivateBalance } from "@/components/treasury/PrivateBalance";
import { DepositForm } from "@/components/treasury/DepositForm";
import { DisbursementForm } from "@/components/treasury/DisbursementForm";
import { useUmbra } from "@/contexts/UmbraContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { scanUtxos, claimReceivedUtxos } from "@/lib/umbra/mixer";
import { useToast } from "@/components/ui/Toast";

type ActiveTab = "deposit" | "disburse" | "claim";

function extractReceivedUtxos(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") {
    const received = (result as { received?: unknown; publicReceived?: unknown }).received;
    const publicReceived = (result as { publicReceived?: unknown }).publicReceived;
    return [
      ...(Array.isArray(received) ? received : []),
      ...(Array.isArray(publicReceived) ? publicReceived : []),
    ];
  }
  return [];
}

export default function TreasuryPage() {
  const { client, isRegistered } = useUmbra();
  const wallet = useWallet();
  const { success, error, info } = useToast();
  const [tab, setTab] = useState<ActiveTab>("deposit");
  const [scanning, setScanning] = useState(false);
  const [claiming, setClaiming] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [utxos, setUtxos] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleScan = async () => {
    if (!client) return;
    setScanning(true);
    try {
      info("Scanning UTXO tree…", "Searching for claimable UTXOs directed to your wallet.");
      const found = await scanUtxos(client, 0, 0, 1023);
      const list = extractReceivedUtxos(found);
      setUtxos(list);
      if (list.length > 0) {
        success(`Found ${list.length} claimable UTXO(s)`, "Click Claim to move funds into your encrypted balance.");
      } else {
        info("No UTXOs found", "No pending claimable UTXOs for your wallet.");
      }
    } catch (e) {
      error("Scan failed", String(e));
    } finally {
      setScanning(false);
    }
  };

  const handleClaim = async () => {
    if (!client || utxos.length === 0) return;
    setClaiming(true);
    try {
      info("Claiming UTXOs…", `Moving ${utxos.length} UTXO(s) into your encrypted balance.`);
      await claimReceivedUtxos(client, utxos);
      success("UTXOs claimed!", "Funds are now in your encrypted balance.");
      setUtxos([]);
      setRefreshKey(k => k + 1);
    } catch (e) {
      error("Claim failed", String(e));
    } finally {
      setClaiming(false);
    }
  };

  const TABS: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: "deposit",  label: "Shield Funds",  icon: <Vault size={15} /> },
    { id: "disburse", label: "Disburse",       icon: <Download size={15} /> },
    { id: "claim",    label: "Claim UTXOs",    icon: <ScanLine size={15} /> },
  ];

  // ── Wallet not connected guard ───────────────────────────────────────────────
  if (!wallet.connected) {
    return (
      <AppShell>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}
        >
          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: "0 auto 24px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Vault size={32} style={{ color: "var(--accent-violet)" }} />
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Private Treasury</h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 32, lineHeight: 1.7 }}>
            Connect a Solana wallet to shield funds, disburse anonymously, and claim UTXOs via the Umbra privacy protocol.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            <WalletMultiButton style={{
              background: "var(--accent-primary)",
              color: "var(--bg-base)",
              borderRadius: 12,
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 15,
              padding: "12px 28px",
              border: "1px solid var(--accent-primary)",
            }} />
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Don&apos;t have an account?{" "}
              <Link href="/register" style={{ color: "var(--accent-teal)", textDecoration: "none" }}>
                Register with Umbra first
              </Link>
            </p>
          </div>
        </motion.div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Vault size={28} style={{ color: "var(--accent-violet)" }} />
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700 }}>Private Treasury</h1>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 2 }}>
                Shield, disburse, and claim funds via Umbra privacy protocol.
              </p>
            </div>
          </div>

          {/* Registration nudge */}
          {!isRegistered && (
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 16px", borderRadius: 10,
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.3)",
                fontSize: 13, color: "#fbbf24",
              }}
            >
              <AlertTriangle size={14} />
              <span>Umbra registration required</span>
              <Link href="/register" style={{ textDecoration: "none" }}>
                <Button variant="primary" size="sm" icon={<ArrowRight size={13} />}>Register</Button>
              </Link>
            </motion.div>
          )}
        </div>

        {/* Balance card — full width */}
        <PrivateBalance key={refreshKey} />

        {/* Tab selector */}
        <div style={{ display: "flex", gap: 8, background: "var(--bg-elevated)", borderRadius: 12, padding: 4, width: "fit-content" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer",
                fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13,
                background: tab === t.id ? "var(--text-primary)" : "transparent",
                color: tab === t.id ? "var(--bg-base)" : "var(--text-secondary)",
                transition: "all 0.2s",
              }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {tab === "deposit"  && <DepositForm onSuccess={() => setRefreshKey(k => k + 1)} />}
          {tab === "disburse" && <DisbursementForm />}
          {tab === "claim"    && (
            <Card style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ScanLine size={20} style={{ color: "var(--accent-teal)" }} />
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>UTXO Scanner &amp; Claimer</h3>
                <Badge variant="teal">Mixer</Badge>
              </div>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                Scan the Umbra UTXO tree for anonymous disbursements directed to your wallet, then claim them into your encrypted balance.
              </p>
              {utxos.length > 0 && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.25)", fontSize: 13, color: "var(--accent-teal-light)" }}>
                  {utxos.length} claimable UTXO(s) found — ready to claim.
                </div>
              )}
              <div style={{ display: "flex", gap: 12 }}>
                <Button variant="secondary" size="md" icon={<ScanLine size={15} />}
                  loading={scanning} disabled={!isRegistered || !client}
                  onClick={handleScan} style={{ flex: 1 }}>
                  Scan UTXOs
                </Button>
                <Button variant="teal" size="md" icon={<Download size={15} />}
                  loading={claiming} disabled={utxos.length === 0 || !client}
                  onClick={handleClaim} style={{ flex: 1 }}>
                  Claim {utxos.length > 0 ? `(${utxos.length})` : ""}
                </Button>
              </div>
            </Card>
          )}
        </motion.div>
      </motion.div>
    </AppShell>
  );
}

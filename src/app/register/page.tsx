"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserCheck, CheckCircle, Circle, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button, Card, Badge } from "@/components/ui/primitives";
import { useUmbra } from "@/contexts/UmbraContext";
import { registerUser } from "@/lib/umbra/registration";
import { SOLANA_NETWORK } from "@/lib/utils/constants";
import { useToast } from "@/components/ui/Toast";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletName } from "@solana/wallet-adapter-phantom";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import Link from "next/link";

type RegStep = "check" | "registering" | "done" | "already";

const TX_STEPS = [
  { label: "Initialize account on-chain", desc: "Creates your Umbra identity account" },
  { label: "Set encryption keys", desc: "Registers your X25519 viewing key" },
  { label: "Submit ZK proof", desc: "Proves key ownership via zero-knowledge" },
];

const MIN_REGISTRATION_SOL = 0.015;

function getNestedValue(error: unknown, key: string): unknown {
  if (!error || typeof error !== "object") return undefined;
  return (error as Record<string, unknown>)[key];
}

function extractSimulationLogs(error: unknown): string[] {
  const direct = getNestedValue(error, "simulationLogs");
  if (Array.isArray(direct)) return direct.map(String);

  const cause = getNestedValue(error, "cause");
  if (cause && cause !== error) return extractSimulationLogs(cause);

  return [];
}

function formatRegistrationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const stage = getNestedValue(error, "stage");
  const logs = extractSimulationLogs(error);

  const details: string[] = [];
  if (typeof stage === "string") details.push(`Stage: ${stage}`);
  if (logs.length > 0) details.push(`Simulation logs: ${logs.slice(-4).join(" | ")}`);

  return details.length > 0 ? `${message}\n${details.join("\n")}` : message;
}

export default function RegisterPage() {
  const { client, isRegistered, isInitialising, initError, refreshRegistration } = useUmbra();
  const wallet = useWallet();
  const { connection } = useConnection();
  const { success, error, info } = useToast();

  const [step, setStep] = useState<RegStep>("check");
  const [currentTx, setCurrentTx] = useState(-1);
  const [completedTxs, setCompletedTxs] = useState<number[]>([]);
  const [sigs, setSigs] = useState<string[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isRegistered) queueMicrotask(() => setStep("already"));
  }, [isRegistered]);

  const handleRegister = async () => {
    if (!client || !wallet.publicKey) return;

    if (wallet.wallet?.adapter.name !== PhantomWalletName) {
      const msg = "ShadowDAO currently supports Phantom only for Umbra devnet registration. Disconnect and reconnect with Phantom.";
      setErrMsg(msg);
      error("Unsupported wallet", msg);
      return;
    }

    if (SOLANA_NETWORK !== "devnet") {
      const msg = `Umbra registration is locked to devnet for this MVP, but the app is configured for ${SOLANA_NETWORK}.`;
      setErrMsg(msg);
      error("Wrong network", msg);
      return;
    }

    const lamports = await connection.getBalance(wallet.publicKey, "confirmed");
    const sol = lamports / LAMPORTS_PER_SOL;
    if (sol < MIN_REGISTRATION_SOL) {
      const msg = `Your Phantom devnet balance is ${sol.toFixed(4)} SOL. Registration needs at least ${MIN_REGISTRATION_SOL} devnet SOL for fees and rent. Airdrop devnet SOL to this wallet, then try again.`;
      setErrMsg(msg);
      error("Not enough devnet SOL", msg);
      return;
    }
    setStep("registering");
    setErrMsg(null);
    setCompletedTxs([]);
    setSigs([]);

    try {
      info("Registering…", "3 transactions will be sent sequentially. Approve each in your wallet.");
      const result = await registerUser(client, {
        userAccountInitialisation: {
          pre: async () => setCurrentTx(0),
          post: async () => setCompletedTxs((prev) => [...prev, 0]),
        },
        registerX25519PublicKey: {
          pre: async () => setCurrentTx(1),
          post: async () => setCompletedTxs((prev) => [...prev, 1]),
        },
        registerUserForAnonymousUsage: {
          pre: async () => setCurrentTx(2),
          post: async () => setCompletedTxs((prev) => [...prev, 2]),
        },
      });
      const txSigs: string[] = Array.isArray(result) ? result : [String(result)];
      setSigs(txSigs);
      setCompletedTxs([0, 1, 2]);
      setCurrentTx(-1);
      await refreshRegistration();
      setStep("done");
      success("Registered with Umbra!", "Your privacy identity is active on Solana devnet.");
    } catch (e: unknown) {
      const msg = formatRegistrationError(e);
      console.error("Umbra registration failed:", e);
      setErrMsg(msg);
      error("Registration failed", msg);
      setStep("check");
      setCurrentTx(-1);
    }
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <UserCheck size={28} style={{ color: "var(--accent-violet)" }} />
            <h1 style={{ fontSize: 28, fontWeight: 700 }}>Umbra Registration</h1>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
            Register your wallet as an anonymous member of the Umbra privacy network.
            This sends 3 sequential on-chain transactions.
          </p>
        </motion.div>

        {/* Not connected */}
        {!wallet.connected && (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <AlertTriangle size={32} style={{ color: "var(--warning)", margin: "0 auto 16px" }} />
            <p style={{ marginBottom: 20, color: "var(--text-secondary)" }}>Connect a Solana wallet to register.</p>
            <WalletMultiButton style={{
              background: "var(--accent-primary)", color: "var(--bg-base)",
              borderRadius: 10, fontFamily: "var(--font-display)", fontWeight: 600,
            }} />
          </Card>
        )}

        {/* Loading / init */}
        {wallet.connected && isInitialising && (
          <Card style={{ display: "flex", alignItems: "center", gap: 12, padding: 28 }}>
            <Loader2 size={20} style={{ color: "var(--accent-violet)", animation: "spin-slow 0.8s linear infinite" }} />
            <span style={{ color: "var(--text-secondary)" }}>Initialising Umbra client…</span>
          </Card>
        )}

        {/* Already registered */}
        {wallet.connected && !isInitialising && step === "already" && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
            <Card elevated style={{ textAlign: "center", padding: 40 }}>
              <CheckCircle size={48} style={{ color: "var(--success)", margin: "0 auto 16px" }} />
              <h2 style={{ fontSize: 22, marginBottom: 8 }}>You&apos;re already registered!</h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
                Your wallet is a verified Umbra member. Head to the dashboard.
              </p>
              <Badge variant="teal" dot>Anonymous Member · Devnet</Badge>
              <div style={{ marginTop: 28 }}>
                <Link href="/dashboard" style={{ textDecoration: "none" }}>
                  <Button variant="primary" size="lg">Go to Dashboard</Button>
                </Link>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Register flow */}
        {wallet.connected && !isInitialising && (step === "check" || step === "registering" || step === "done") && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {initError && (
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", fontSize: 13, color: "var(--error)" }}>
                {initError}
              </div>
            )}

            {/* TX Steps */}
            <Card style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Transaction Steps</h3>
              {TX_STEPS.map((tx, i) => {
                const done = completedTxs.includes(i);
                const active = currentTx === i;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <AnimatePresence mode="wait">
                      {done ? (
                        <motion.div key="done" initial={{ scale: 0.5 }} animate={{ scale: 1 }}>
                          <CheckCircle size={22} style={{ color: "var(--success)", flexShrink: 0 }} />
                        </motion.div>
                      ) : active ? (
                        <motion.div key="active" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>
                          <Loader2 size={22} style={{ color: "var(--accent-violet)", flexShrink: 0 }} />
                        </motion.div>
                      ) : (
                        <Circle size={22} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      )}
                    </AnimatePresence>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: done ? 600 : 400, color: done ? "var(--text-primary)" : active ? "var(--accent-violet-light)" : "var(--text-muted)" }}>
                        {tx.label}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{tx.desc}</p>
                    </div>
                  </div>
                );
              })}
            </Card>

            {/* Error */}
            {errMsg && (
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", fontSize: 13, color: "var(--error)" }}>
                {errMsg}
              </div>
            )}

            {/* Transaction links */}
            {sigs.length > 0 && (
              <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Transaction Signatures</p>
                {sigs.map((sig, i) => (
                  <a key={sig} href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent-teal)", textDecoration: "none", fontFamily: "var(--font-mono)" }}>
                    <ExternalLink size={12} />
                    Tx {i + 1}: {sig.slice(0, 32)}…
                  </a>
                ))}
              </Card>
            )}

            {/* CTA */}
            {step === "done" ? (
              <Link href="/dashboard" style={{ textDecoration: "none" }}>
                <Button variant="teal" size="lg" style={{ width: "100%" }}>
                  Go to Dashboard →
                </Button>
              </Link>
            ) : (
              <Button variant="primary" size="lg"
                icon={<UserCheck size={18} />}
                loading={step === "registering"}
                disabled={!client || !!initError || step === "registering"}
                onClick={handleRegister}
                style={{ width: "100%" }}>
                {step === "registering" ? "Registering…" : "Register with Umbra"}
              </Button>
            )}
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}

"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Shield, ArrowDown, CheckCircle, Clock, AlertTriangle, ChevronDown } from "lucide-react";
import { Button, Input, Card, Badge } from "@/components/ui/primitives";
import { useUmbra } from "@/contexts/UmbraContext";
import { depositToEncryptedBalance } from "@/lib/umbra/deposit";
import { TOKEN_LIST } from "@/lib/utils/constants";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/components/ui/Toast";
import type { Address } from "@solana/addresses";
import { PublicKey } from "@solana/web3.js";
import { parseTokenAmount } from "@/lib/utils/validation";

type DepositStep = "idle" | "signing" | "queued" | "finalised" | "error";

function getNestedValue(error: unknown, key: string): unknown {
  if (!error || typeof error !== "object") return undefined;
  return (error as Record<string, unknown>)[key];
}

function collectErrorMessages(error: unknown): string[] {
  if (!error) return [];
  if (typeof error === "string") return [error];
  if (error instanceof Error) {
    return [error.message, ...collectErrorMessages(getNestedValue(error, "cause"))];
  }

  const message = getNestedValue(error, "message");
  return [
    ...(typeof message === "string" ? [message] : []),
    ...collectErrorMessages(getNestedValue(error, "cause")),
  ];
}

function extractSimulationLogs(error: unknown): string[] {
  const directLogs = getNestedValue(error, "logs");
  if (Array.isArray(directLogs)) return directLogs.map(String);

  const simulationLogs = getNestedValue(error, "simulationLogs");
  if (Array.isArray(simulationLogs)) return simulationLogs.map(String);

  const cause = getNestedValue(error, "cause");
  if (cause && cause !== error) return extractSimulationLogs(cause);

  return [];
}

function formatDepositError(error: unknown): string {
  const messageChain = collectErrorMessages(error).join(" | ").toLowerCase();
  const message = error instanceof Error ? error.message : String(error);
  const stage = getNestedValue(error, "stage");
  const code = getNestedValue(error, "code");
  const logs = extractSimulationLogs(error);

  if (messageChain.includes("#3012") || messageChain.includes("sign pda account")) {
    return [
      "This token mint is not usable for Umbra shielding on this network.",
      "Umbra could not derive the protocol accounts it needs for the selected mint.",
      "Use an Umbra-supported devnet mint instead of a custom SPL token.",
    ].join("\n");
  }

  const details: string[] = [];
  if (typeof code === "string") details.push(`Code: ${code}`);
  if (typeof stage === "string") details.push(`Stage: ${stage}`);
  if (logs.length > 0) details.push(`Logs: ${logs.slice(-6).join(" | ")}`);

  return details.length > 0 ? `${message}\n${details.join("\n")}` : message;
}

export function DepositForm({ onSuccess }: { onSuccess?: () => void }) {
  const { client, isRegistered } = useUmbra();
  const wallet = useWallet();
  const { connection } = useConnection();
  const { success, error: toastError, info } = useToast();

  const [amount, setAmount] = useState("");
  const [selectedTokenIdx, setSelectedTokenIdx] = useState(0);
  const [step, setStep] = useState<DepositStep>("idle");
  const [queueSig, setQueueSig] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const selectedToken = TOKEN_LIST[selectedTokenIdx];

  const handleDeposit = async () => {
    if (!client || !wallet.publicKey) return;
    let lamports: bigint;
    try {
      lamports = parseTokenAmount(amount, selectedToken.decimals);
    } catch (e) {
      toastError("Invalid amount", e instanceof Error ? e.message : `Please enter a valid ${selectedToken.symbol} amount.`);
      return;
    }

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      wallet.publicKey,
      { mint: new PublicKey(selectedToken.mint) },
      "confirmed"
    );
    const availableBalance = tokenAccounts.value.reduce((total, account) => {
      const parsedAmount = account.account.data.parsed.info.tokenAmount.amount;
      return total + BigInt(parsedAmount);
    }, BigInt(0));

    if (availableBalance < lamports) {
      toastError(
        "Insufficient token balance",
        `Wallet A needs public ${selectedToken.symbol} in Phantom before it can shield funds. Available: ${(Number(availableBalance) / 10 ** selectedToken.decimals).toFixed(selectedToken.decimals)} ${selectedToken.symbol}.`
      );
      return;
    }

    const address = wallet.publicKey.toBase58() as Address;

    setStep("signing");
    setErrMsg(null);

    try {
      info("Signing transaction", "Please approve in your wallet…");
      const result = await depositToEncryptedBalance(client, address, selectedToken.mint, lamports);

      setQueueSig(result?.queueSignature ?? null);
      setStep("queued");
      info("Queued with Arcium MPC", "The MPC network is processing your deposit…");

      // Poll / listen for callback (simplified: show queued state)
      if (result?.callbackStatus === "finalized" || result?.callbackSignature) {
        setStep("finalised");
        success("Deposit finalised!", `${amount} ${selectedToken.symbol} shielded into your encrypted balance.`);
        onSuccess?.();
      } else {
        // Arcium MPC may take a few seconds — inform user
        setStep("finalised");
        success("Deposit submitted!", "Arcium MPC is finalising. Your balance will update shortly.");
        onSuccess?.();
      }
    } catch (e: unknown) {
      setStep("error");
      console.error("Deposit failed:", e);
      const msg = formatDepositError(e);
      setErrMsg(msg);
      toastError("Deposit failed", msg);
    }
  };

  const stepConfig: Record<DepositStep, { icon: React.ReactNode; label: string; color: string }> = {
    idle:      { icon: <ArrowDown size={14} />,      label: "Ready",       color: "var(--text-muted)" },
    signing:   { icon: <Clock size={14} />,          label: "Signing…",    color: "var(--warning)" },
    queued:    { icon: <Clock size={14} />,          label: "Queued (MPC)", color: "var(--accent-violet-light)" },
    finalised: { icon: <CheckCircle size={14} />,    label: "Finalised",   color: "var(--success)" },
    error:     { icon: <AlertTriangle size={14} />,  label: "Error",       color: "var(--error)" },
  };

  const cfg = stepConfig[step];

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Shield size={20} style={{ color: "var(--accent-violet)" }} />
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Shield Funds</h3>
        <Badge variant="violet">Direct Deposit</Badge>
      </div>

      {!isRegistered && (
        <div style={{
          padding: "10px 14px", borderRadius: 10,
          background: "rgba(245,158,11,0.1)",
          border: "1px solid rgba(245,158,11,0.3)",
          color: "#fbbf24", fontSize: 13,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle size={14} />
          You must register with Umbra before depositing.
        </div>
      )}

      {/* Token selector */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}>
          Token
        </label>
        <div style={{ position: "relative" }}>
          <select
            value={selectedTokenIdx}
            onChange={(e) => setSelectedTokenIdx(Number(e.target.value))}
            disabled={!isRegistered || step === "signing" || step === "queued"}
            style={{
              width: "100%",
              appearance: "none",
              background: "rgba(14,14,26,0.8)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 10,
              padding: "10px 40px 10px 14px",
              color: "var(--text-primary)",
              fontSize: 14,
              fontFamily: "var(--font-sans)",
              outline: "none",
              cursor: !isRegistered ? "not-allowed" : "pointer",
            }}
          >
            {TOKEN_LIST.map((t, i) => (
              <option key={`${t.symbol}-${t.mint}-${i}`} value={i} style={{ background: "var(--bg-elevated)" }}>
                {t.symbol} — {t.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} style={{
            position: "absolute", right: 12, top: "50%",
            transform: "translateY(-50%)", color: "var(--text-muted)",
            pointerEvents: "none",
          }} />
        </div>
      </div>

      <Input
        label={`Amount (${selectedToken.symbol})`}
        type="number"
        min="0"
        step="0.01"
        placeholder="e.g. 10.00"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        hint={`Funds are shielded via Umbra — your ${selectedToken.symbol} balance becomes private immediately.`}
        disabled={!isRegistered || step === "signing" || step === "queued"}
      />

      {/* Status indicator */}
      {step !== "idle" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px", borderRadius: 10,
            background: "rgba(124,58,237,0.08)",
            border: "1px solid var(--border-subtle)",
            fontSize: 13, color: cfg.color,
          }}
        >
          {cfg.icon}
          <span style={{ fontWeight: 600 }}>{cfg.label}</span>
          {queueSig && (
            <a
              href={`https://explorer.solana.com/tx/${queueSig}?cluster=devnet`}
              target="_blank" rel="noopener noreferrer"
              style={{ marginLeft: "auto", fontSize: 12, color: "var(--accent-teal)", textDecoration: "none" }}
            >
              View tx ↗
            </a>
          )}
        </motion.div>
      )}

      {errMsg && step === "error" && (
        <p style={{ fontSize: 12, color: "var(--error)", wordBreak: "break-word" }}>{errMsg}</p>
      )}

      <Button
        variant="primary"
        size="lg"
        icon={<Shield size={16} />}
        loading={step === "signing" || step === "queued"}
        disabled={!isRegistered || !client || !amount}
        onClick={handleDeposit}
        style={{ width: "100%" }}
      >
        Shield {amount ? `${amount} ${selectedToken.symbol}` : "Funds"}
      </Button>
    </Card>
  );
}

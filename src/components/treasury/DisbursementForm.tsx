"use client";

import React, { useState } from "react";
import { Send, Zap, ExternalLink, ChevronDown } from "lucide-react";
import { Button, Input, Card, Badge } from "@/components/ui/primitives";
import { useUmbra } from "@/contexts/UmbraContext";
import { createReceiverClaimableUtxo } from "@/lib/umbra/disbursement";
import { TOKEN_LIST } from "@/lib/utils/constants";
import { getPanicState } from "@/lib/store/panic";
import { useToast } from "@/components/ui/Toast";
import { motion } from "framer-motion";
import type { Address } from "@solana/addresses";
import { isValidSolanaAddress, parseTokenAmount } from "@/lib/utils/validation";

export function DisbursementForm({ recipient, amountRaw, mintAddress, onSuccess }: {
  recipient?: string;
  amountRaw?: bigint;
  /** Pre-selected mint address — if provided the token selector is hidden */
  mintAddress?: string;
  onSuccess?: (sig: string) => void;
}) {
  const { client, isRegistered } = useUmbra();
  const { success, error: toastError, info } = useToast();

  // Resolve pre-selected token or default to first in list
  const defaultTokenIdx = mintAddress
    ? Math.max(TOKEN_LIST.findIndex((t) => t.mint === mintAddress), 0)
    : 0;

  const [toAddress, setToAddress] = useState(recipient ?? "");
  const [amount, setAmount] = useState(amountRaw ? String(Number(amountRaw) / 1_000_000) : "");
  const [selectedTokenIdx, setSelectedTokenIdx] = useState(defaultTokenIdx);
  const [loading, setLoading] = useState(false);
  const [sigs, setSigs] = useState<string[]>([]);

  const selectedToken = TOKEN_LIST[selectedTokenIdx];
  const decimals = selectedToken.decimals;

  const handleDisburse = async () => {
    if (!client) return;
    if (!isValidSolanaAddress(toAddress)) {
      toastError("Invalid recipient", "Enter a valid Solana wallet address.");
      return;
    }
    let lamports: bigint;
    try {
      lamports = parseTokenAmount(amount, decimals);
    } catch (e) {
      toastError("Invalid amount", e instanceof Error ? e.message : "Enter a valid token amount.");
      return;
    }
    setLoading(true);
    try {
      info("Building ZK proof", "Generating proof account — tx 1 of 2…");
      const panicState = await getPanicState(1);
      if (
        panicState.policy.isArmed &&
        panicState.policy.disbursementsFrozen &&
        !panicState.policy.safetyRecipients.includes(toAddress)
      ) {
        throw new Error("Panic mode is active: recipient is not on the safety allowlist.");
      }

      const signatures = await createReceiverClaimableUtxo(
        client,
        toAddress as Address,
        selectedToken.mint,
        lamports
      );
      setSigs(signatures);
      success("Disbursement sent!", `${amount} ${selectedToken.symbol} anonymously routed via UTXO mixer.`);
      onSuccess?.(signatures[signatures.length - 1] ?? "");
    } catch (e: unknown) {
      toastError("Disbursement failed", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Zap size={20} style={{ color: "var(--accent-teal)" }} />
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Anonymous Disbursement</h3>
        <Badge variant="teal">UTXO Mixer</Badge>
      </div>

      <Input
        label="Recipient Umbra Address"
        placeholder="Base58 wallet address…"
        value={toAddress}
        onChange={e => setToAddress(e.target.value)}
        disabled={!!recipient || loading}
        hint="Funds are routed via the Umbra mixer — recipient identity is fully private."
      />

      {/* Token selector — hidden when mint is pre-determined from a proposal */}
      {!mintAddress && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}>
            Token
          </label>
          <div style={{ position: "relative" }}>
            <select
              value={selectedTokenIdx}
              onChange={(e) => setSelectedTokenIdx(Number(e.target.value))}
              disabled={loading}
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
                cursor: loading ? "not-allowed" : "pointer",
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
      )}

      <Input
        label={`Amount (${selectedToken.symbol})`}
        type="number" min="0" step="0.01"
        placeholder="e.g. 100.00"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        disabled={!!amountRaw || loading}
      />

      {sigs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", flexDirection: "column", gap: 6 }}
        >
          {sigs.map((sig, i) => (
            <a key={sig}
              href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent-teal)", textDecoration: "none" }}
            >
              <ExternalLink size={12} />
              Tx {i + 1}: {sig.slice(0, 24)}…
            </a>
          ))}
        </motion.div>
      )}

      <Button
        variant="teal" size="lg"
        icon={<Send size={16} />}
        loading={loading}
        disabled={!isRegistered || !client || !toAddress || !amount}
        onClick={handleDisburse}
        style={{ width: "100%" }}
      >
        {loading ? "Sending…" : `Disburse ${amount ? `${amount} ${selectedToken.symbol}` : ""}`}
      </Button>
    </Card>
  );
}

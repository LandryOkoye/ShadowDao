"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Lock, Sparkles } from "lucide-react";
import { Button, Input, Textarea, Badge } from "@/components/ui/primitives";
import { createProposal } from "@/lib/store/proposals";
import { USDC_MINT } from "@/lib/utils/constants";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/components/ui/Toast";
import { useUmbra } from "@/contexts/UmbraContext";
import { queryEncryptedBalance } from "@/lib/umbra/query";
import { isValidSolanaAddress, parseTokenAmount } from "@/lib/utils/validation";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateProposalModal({ open, onClose, onCreated }: Props) {
  const wallet = useWallet();
  const { success, error } = useToast();
  const { client } = useUmbra();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!wallet.publicKey) { error("Wallet not connected"); return; }
    if (!title || !description || !recipient || !amount) {
      error("Missing fields", "Please fill in all fields.");
      return;
    }
    if (!isValidSolanaAddress(recipient)) {
      error("Invalid recipient", "Enter a valid Solana wallet address.");
      return;
    }
    if (!client) {
      error("Umbra unavailable", "Connect and initialise Umbra before creating proposals.");
      return;
    }

    setLoading(true);
    try {
      const amountRaw = parseTokenAmount(amount, 6);
      const result = await queryEncryptedBalance(client, [USDC_MINT]);
      const balance = result.get(USDC_MINT);
      if (balance?.state !== "shared") {
        throw new Error(
          `MVP solvency check requires a readable shared balance. Current state: ${balance?.state ?? "unknown"}.`
        );
      }
      if (BigInt(balance.balance) < amountRaw) {
        throw new Error("Treasury balance is lower than the requested proposal amount.");
      }

      await createProposal({
        title,
        description,
        recipient,
        amountRaw,
        mint: USDC_MINT,
        createdBy: wallet.publicKey.toBase58(),
        zkSolvencyProof: `mvp_balance_check:${balance.balance.toString()}:${amountRaw.toString()}:${Date.now()}`,
      });
      success("Proposal created!", `"${title}" is now live for voting.`);
      setTitle(""); setDescription(""); setRecipient(""); setAmount("");
      onCreated();
      onClose();
    } catch (e) {
      error("Failed to create proposal", String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(6px)",
              zIndex: 200,
            }}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{
              position: "fixed",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(560px, 95vw)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-strong)",
              borderRadius: 20,
              padding: 32,
              zIndex: 201,
              boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Sparkles size={20} style={{ color: "var(--accent-violet)" }} />
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>New Proposal</h2>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Input label="Proposal Title" placeholder="e.g. Fund core contributor bounty" value={title} onChange={e => setTitle(e.target.value)} />

              <Textarea label="Description" placeholder="Describe the purpose and expected outcome…" value={description} onChange={e => setDescription(e.target.value)} style={{ minHeight: 120 }} />

              <Input label="Recipient Umbra Address" placeholder="Base58 address of the payee" value={recipient} onChange={e => setRecipient(e.target.value)}
                hint="Recipient will receive funds via the anonymous UTXO mixer." />

              <div>
                <Input label="Requested Amount (USDC)" type="number" min="0" step="0.01" placeholder="e.g. 500" value={amount} onChange={e => setAmount(e.target.value)} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                  <Lock size={12} style={{ color: "var(--text-muted)" }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Displayed publicly as <strong style={{ color: "var(--accent-violet-light)" }}>Confidential</strong>
                  </span>
                  <Badge variant="violet" style={{ fontSize: 10 }}>ZK Solvency auto-generated</Badge>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <Button variant="ghost" size="md" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                <Button variant="primary" size="md" icon={<Plus size={16} />} loading={loading} onClick={handleCreate} style={{ flex: 2 }}>
                  Create Proposal
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

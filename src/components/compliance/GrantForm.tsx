"use client";

import React, { useState } from "react";
import { ShieldCheck, Plus } from "lucide-react";
import { Button, Input, Card, Badge } from "@/components/ui/primitives";
import { useUmbra } from "@/contexts/UmbraContext";
import { grantViewingAccess } from "@/lib/umbra/compliance";
import { deriveUserX25519PublicKey } from "@/lib/umbra/keys";
import { useToast } from "@/components/ui/Toast";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Address } from "@solana/addresses";
import { generateNonce, isValidBase64Bytes, isValidSolanaAddress } from "@/lib/utils/validation";

interface GrantRecord {
  receiver: string;
  receiverX25519: string;
  granterX25519: string;
  nonce: string;
  txSig?: string;
  grantedAt: number;
}

interface Props {
  onGranted: (record: GrantRecord) => void;
}

export function GrantForm({ onGranted }: Props) {
  const { client } = useUmbra();
  const wallet = useWallet();
  const { success, error, info } = useToast();

  const [receiver, setReceiver]         = useState("");
  const [receiverX25519, setRX25519]    = useState("");
  const [granterX25519, setGX25519]     = useState("");
  const [nonce, setNonce]               = useState(() => generateNonce());
  const [loading, setLoading]           = useState(false);
  const [deriving, setDeriving]         = useState(false);

  const handleDerive = async () => {
    if (!client) return;
    setDeriving(true);
    try {
      const key = await deriveUserX25519PublicKey(client);
      setGX25519(key);
      success("X25519 key derived", "Your public viewing key has been filled in.");
    } catch (e) {
      error("Key derivation failed", e instanceof Error ? e.message : String(e));
    } finally {
      setDeriving(false);
    }
  };

  const handleGrant = async () => {
    if (!client || !wallet.publicKey) { error("Wallet not connected"); return; }
    if (!receiver || !receiverX25519 || !granterX25519 || !nonce) {
      error("Missing fields", "All fields are required.");
      return;
    }
    if (!isValidSolanaAddress(receiver)) {
      error("Invalid receiver", "Enter a valid auditor wallet address.");
      return;
    }
    if (!isValidBase64Bytes(granterX25519, 32) || !isValidBase64Bytes(receiverX25519, 32)) {
      error("Invalid X25519 key", "X25519 public keys must be 32-byte base64 values.");
      return;
    }

    setLoading(true);
    try {
      info("Submitting compliance grant…", "Please approve the transaction.");
      const result = await grantViewingAccess(client, receiver as Address, granterX25519, receiverX25519, nonce);
      const sig = typeof result === "string" ? result : (result as { signature?: string })?.signature;

      success("Grant issued!", "Auditor now has time-boxed viewing access.");
      onGranted({ receiver, receiverX25519, granterX25519, nonce, txSig: sig, grantedAt: Date.now() });

      setReceiver(""); setRX25519(""); setGX25519(""); setNonce(generateNonce());
    } catch (e) {
      error("Grant failed", String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <ShieldCheck size={20} style={{ color: "var(--accent-teal)" }} />
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Issue Viewing Grant</h3>
        <Badge variant="teal">Compliance</Badge>
      </div>

      <Input label="Receiver (Auditor) Address" placeholder="Base58 wallet address" value={receiver} onChange={e => setReceiver(e.target.value)} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Input label="Granter X25519 Public Key" placeholder="Base64 X25519 key" value={granterX25519} onChange={e => setGX25519(e.target.value)} />
        <Button variant="secondary" size="sm" loading={deriving} disabled={!client} onClick={handleDerive}>
          Derive My X25519 Key
        </Button>
      </div>
      <Input label="Receiver X25519 Public Key" placeholder="Base64 X25519 key" value={receiverX25519} onChange={e => setRX25519(e.target.value)} />
      <Input label="Nonce" placeholder="Unique nonce string" value={nonce} onChange={e => setNonce(e.target.value)}
        hint="Use a unique nonce per grant to allow selective revocation." />

      <Button variant="teal" size="md" icon={<Plus size={16} />} loading={loading}
        disabled={!client || !receiver || !receiverX25519 || !granterX25519 || !nonce}
        onClick={handleGrant} style={{ width: "100%" }}>
        Issue Grant
      </Button>
    </Card>
  );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Waves, Clock3, Coins, ExternalLink } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { useUmbra } from "@/contexts/UmbraContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/components/ui/Toast";
import { createReceiverClaimableUtxo } from "@/lib/umbra/disbursement";
import { checkpointStreamClaim, getStreams, type StreamWithRuntime } from "@/lib/store/streams";
import type { Address } from "@solana/addresses";
import { generateNonce } from "@/lib/utils/validation";

function formatTokenAmount(raw: bigint, decimals = 6): string {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;
  return `${whole.toString()}.${fraction.toString().padStart(decimals, "0").slice(0, 2)}`;
}

export default function StreamsPage() {
  const { client, isRegistered } = useUmbra();
  const wallet = useWallet();
  const { success, error, info } = useToast();
  const [streams, setStreams] = useState<StreamWithRuntime[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const address = wallet.publicKey?.toBase58() ?? "";

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const rows = await getStreams({ recipient: address });
      setStreams(rows);
    } catch (e) {
      error("Failed to load streams", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [address, error]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const claim = async (stream: StreamWithRuntime) => {
    if (!client || !wallet.publicKey) return;
    const claimable = stream.runtime.claimableAmountRaw;
    if (claimable <= 0n) {
      error("Nothing to claim", "No unlocked payout is available right now.");
      return;
    }

    setClaimingId(stream.id);
    try {
      info("Creating private payout...", "Approve the wallet prompts to route claim through Umbra.");
      const sigs = await createReceiverClaimableUtxo(
        client,
        wallet.publicKey.toBase58() as Address,
        stream.mint as Address,
        claimable
      );
      const primarySig = sigs[sigs.length - 1] ?? sigs[0];
      await checkpointStreamClaim({
        streamId: stream.id,
        requestId: generateNonce(),
        claimer: wallet.publicKey.toBase58(),
        amountRaw: claimable,
        txSignature: primarySig,
      });
      success("Stream claimed", `${formatTokenAmount(claimable)} tokens were privately disbursed.`);
      await load();
    } catch (e) {
      error("Stream claim failed", e instanceof Error ? e.message : String(e));
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Waves size={24} style={{ color: "var(--accent-teal)" }} />
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700 }}>Private Streams</h1>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Claim unlocked payroll or grant payouts privately through Umbra.
            </p>
          </div>
        </div>

        {!wallet.connected ? (
          <Card>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Connect a wallet to view your payout streams.</p>
          </Card>
        ) : !isRegistered ? (
          <Card>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Register with Umbra before claiming stream payouts.</p>
          </Card>
        ) : loading ? (
          <Card>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Loading streams...</p>
          </Card>
        ) : streams.length === 0 ? (
          <Card>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>No streams found for this wallet yet.</p>
          </Card>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {streams.map((stream) => {
              const claimable = stream.runtime.claimableAmountRaw;
              const remaining = stream.runtime.remainingAmountRaw;
              return (
                <Card key={stream.id} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Badge variant={stream.status === "active" ? "teal" : stream.status === "completed" ? "green" : "yellow"}>
                        {stream.status.toUpperCase()}
                      </Badge>
                      <code style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {stream.id.slice(0, 12)}...
                      </code>
                    </div>
                    <a
                      href={`/proposals/${stream.proposalId}`}
                      style={{ fontSize: 12, color: "var(--accent-teal)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      Proposal <ExternalLink size={12} />
                    </a>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                    <div>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <Coins size={12} /> Claimable now
                      </p>
                      <p style={{ fontSize: 16, fontWeight: 700 }}>{formatTokenAmount(claimable)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Total</p>
                      <p style={{ fontSize: 15, fontWeight: 600 }}>{formatTokenAmount(stream.totalAmountRaw)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Remaining</p>
                      <p style={{ fontSize: 15, fontWeight: 600 }}>{formatTokenAmount(remaining)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock3 size={12} /> Ends
                      </p>
                      <p style={{ fontSize: 14, fontWeight: 600 }}>{new Date(stream.endAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <Button
                    variant="teal"
                    size="md"
                    loading={claimingId === stream.id}
                    disabled={claimable <= 0n || claimingId === stream.id || !client}
                    onClick={() => void claim(stream)}
                    style={{ width: "100%" }}
                  >
                    Claim Unlocked Amount
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>
    </AppShell>
  );
}

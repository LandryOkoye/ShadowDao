"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ScrollText,
  Lock,
  Zap,
  Waves,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  Calendar,
  Coins,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { Card, Badge, Button } from "@/components/ui/primitives";
import { VotePanel } from "@/components/proposals/VotePanel";
import {
  getProposal,
  markDisbursed,
  type Proposal,
} from "@/lib/store/proposals";
import {
  cancelStream,
  createStream,
  getStreams,
  type StreamWithRuntime,
} from "@/lib/store/streams";
import { getPanicState } from "@/lib/store/panic";
import { useUmbra } from "@/contexts/UmbraContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { createReceiverClaimableUtxo } from "@/lib/umbra/disbursement";
import { useToast } from "@/components/ui/Toast";
import { ADMIN_ADDRESSES } from "@/lib/utils/constants";
import type { Address } from "@solana/addresses";

const STATUS_CONFIG = {
  draft:     { label: "Draft",     variant: "gray"   as const },
  active:    { label: "Active",    variant: "violet" as const, dot: true },
  approved:  { label: "Approved",  variant: "green"  as const },
  disbursed: { label: "Disbursed", variant: "teal"   as const },
  rejected:  { label: "Rejected",  variant: "red"    as const },
};

type DisburseStep = "idle" | "sending" | "done" | "error";

function formatTokenAmount(raw: bigint, decimals = 6): string {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;
  return `${whole.toString()}.${fraction.toString().padStart(decimals, "0").slice(0, 2)}`;
}

export default function ProposalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { client, isRegistered } = useUmbra();
  const wallet = useWallet();
  const { success, error: toastError, info } = useToast();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [disburseStep, setDisburseStep] = useState<DisburseStep>("idle");
  const [disburseSigs, setDisburseSigs] = useState<string[]>([]);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [stream, setStream] = useState<StreamWithRuntime | null>(null);
  const [streamSaving, setStreamSaving] = useState(false);
  const [streamCancelling, setStreamCancelling] = useState(false);
  const [streamStartAt, setStreamStartAt] = useState(() => {
    const now = Date.now();
    return new Date(now + 60 * 60 * 1000).toISOString().slice(0, 16);
  });
  const [streamCliffAt, setStreamCliffAt] = useState(() => {
    const now = Date.now();
    return new Date(now + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  });
  const [streamEndAt, setStreamEndAt] = useState(() => {
    const now = Date.now();
    return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  });

  const load = useCallback(async () => {
    try {
      const p = await getProposal(id);
      if (!p) {
        router.push("/proposals");
        return;
      }
      setProposal(p);
      const related = await getStreams({ proposalId: p.id });
      setStream(related[0] ?? null);
    } catch {
      router.push("/proposals");
    }
  }, [id, router]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const walletAddress = wallet.publicKey?.toBase58() ?? "";
  const isCreator = walletAddress === proposal?.createdBy;
  const isAdmin = isCreator || ADMIN_ADDRESSES.includes(walletAddress);

  const handleDisburse = async () => {
    if (!client || !proposal) return;
    setDisburseStep("sending");
    setErrMsg(null);

    try {
      info(
        "Disbursing via Umbra UTXO mixer…",
        "2 transactions will be sent. Please approve both in your wallet."
      );

      const panicState = await getPanicState(1);
      if (
        panicState.policy.isArmed &&
        panicState.policy.disbursementsFrozen &&
        !panicState.policy.safetyRecipients.includes(proposal.recipient)
      ) {
        throw new Error("Panic mode is active: this recipient is not on the safety allowlist.");
      }

      const sigs = await createReceiverClaimableUtxo(
        client,
        proposal.recipient as Address,
        proposal.mint as Address,
        proposal.amountRaw
      );

      const primarySig = sigs[sigs.length - 1] ?? sigs[0];
      const updated = await markDisbursed(proposal.id, primarySig, walletAddress || undefined);
      setDisburseSigs(sigs);
      setDisburseStep("done");
      setProposal(updated);
      success(
        "Disbursement complete!",
        "Funds routed anonymously via UTXO mixer. Recipient can claim their balance."
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrMsg(msg);
      setDisburseStep("error");
      toastError("Disbursement failed", msg);
    }
  };

  const handleCreateStream = async () => {
    if (!proposal || !walletAddress) return;
    setStreamSaving(true);
    try {
      const created = await createStream({
        proposalId: proposal.id,
        createdBy: walletAddress,
        startAt: new Date(streamStartAt).getTime(),
        cliffAt: new Date(streamCliffAt).getTime(),
        endAt: new Date(streamEndAt).getTime(),
      });
      const related = await getStreams({ proposalId: proposal.id });
      setStream(related.find((s) => s.id === created.id) ?? related[0] ?? null);
      success("Stream created", "Recipient can now claim unlocked payouts over time.");
    } catch (e) {
      toastError("Failed to create stream", e instanceof Error ? e.message : String(e));
    } finally {
      setStreamSaving(false);
    }
  };

  const handleCancelStream = async () => {
    if (!stream || !walletAddress) return;
    setStreamCancelling(true);
    try {
      await cancelStream(stream.id, walletAddress);
      const related = proposal ? await getStreams({ proposalId: proposal.id }) : [];
      setStream(related[0] ?? null);
      success("Stream cancelled", "No new amount will unlock past the cancellation timestamp.");
    } catch (e) {
      toastError("Failed to cancel stream", e instanceof Error ? e.message : String(e));
    } finally {
      setStreamCancelling(false);
    }
  };

  if (!proposal) {
    return (
      <AppShell>
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
          <ScrollText size={40} style={{ margin: "0 auto 16px", opacity: 0.3 }} />
          <p>Loading proposal…</p>
        </div>
      </AppShell>
    );
  }

  const cfg = STATUS_CONFIG[proposal.status];

  return (
    <AppShell>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 860, margin: "0 auto" }}
      >
        {/* Back */}
        <Link href="/proposals" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 14 }}>
          <ArrowLeft size={16} /> Back to Proposals
        </Link>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Badge variant={cfg.variant} dot={"dot" in cfg ? cfg.dot : false}>
                {cfg.label}
              </Badge>
              {proposal.zkSolvencyProof && (
                <Badge variant="violet" style={{ fontSize: 11 }}>
                  <ShieldCheck size={11} /> ZK Solvency ✓
                </Badge>
              )}
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.25, marginBottom: 8 }}>
              {proposal.title}
            </h1>
            <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              {proposal.description}
            </p>
          </div>
        </div>

        {/* Meta grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          {[
            {
              icon: <User size={14} />,
              label: "Created by",
              value: `${proposal.createdBy.slice(0, 6)}…${proposal.createdBy.slice(-4)}`,
              mono: true,
            },
            {
              icon: <Calendar size={14} />,
              label: "Created",
              value: new Date(proposal.createdAt).toLocaleDateString(),
            },
            {
              icon: <Lock size={14} />,
              label: "Requested amount",
              value: "Confidential",
              accent: true,
            },
            {
              icon: <Coins size={14} />,
              label: "Recipient",
              value: `${proposal.recipient.slice(0, 6)}…${proposal.recipient.slice(-4)}`,
              mono: true,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="glass"
              style={{ padding: "14px 18px", borderRadius: 14 }}
            >
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                {item.icon} {item.label}
              </p>
              <p style={{
                fontSize: 14,
                fontWeight: 600,
                fontFamily: item.mono ? "var(--font-mono)" : "var(--font-display)",
                color: item.accent ? "var(--accent-violet-light)" : "var(--text-primary)",
              }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {/* Vote Panel */}
          <Card style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <ScrollText size={18} style={{ color: "var(--accent-violet)" }} />
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Governance</h2>
              <Badge variant="violet" style={{ fontSize: 11 }}>Simulated</Badge>
            </div>
            <VotePanel
              proposal={proposal}
              onUpdate={(p) => setProposal(p)}
              isAdmin={isAdmin}
            />
          </Card>

          {/* Disbursement Panel */}
          <Card style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Zap size={18} style={{ color: "var(--accent-teal)" }} />
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Disbursement</h2>
              <Badge variant="teal" style={{ fontSize: 11 }}>Real · Umbra</Badge>
            </div>

            {proposal.status === "disbursed" ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <CheckCircle size={20} style={{ color: "var(--success)" }} />
                  <p style={{ fontWeight: 600, color: "var(--success)" }}>Disbursement Complete</p>
                </div>
                {proposal.disbursementSig && (
                  <a
                    href={`https://explorer.solana.com/tx/${proposal.disbursementSig}?cluster=devnet`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent-teal)", textDecoration: "none", fontFamily: "var(--font-mono)" }}
                  >
                    <ExternalLink size={12} />
                    {proposal.disbursementSig.slice(0, 28)}…
                  </a>
                )}
              </motion.div>
            ) : proposal.status === "approved" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.25)", fontSize: 13, color: "var(--accent-teal-light)" }}>
                  ✓ Proposal approved — ready to route funds anonymously via the Umbra UTXO mixer.
                </div>

                {!isRegistered && (
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", fontSize: 13, color: "#fbbf24", display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertTriangle size={14} /> Register with Umbra first.
                  </div>
                )}

                {/* Step indicator while sending */}
                <AnimatePresence>
                  {disburseStep === "sending" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ display: "flex", flexDirection: "column", gap: 8 }}
                    >
                      {["Creating ZK proof account", "Submitting UTXO to mixer"].map((step, i) => (
                        <div key={step} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                          >
                            <Clock size={14} style={{ color: "var(--accent-violet)" }} />
                          </motion.div>
                          <span style={{ color: i === 0 ? "var(--accent-violet-light)" : "var(--text-muted)" }}>{step}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {errMsg && (
                  <p style={{ fontSize: 12, color: "var(--error)", wordBreak: "break-word" }}>{errMsg}</p>
                )}

                {disburseSigs.length > 0 && disburseStep === "done" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {disburseSigs.map((sig, i) => (
                      <a
                        key={sig}
                        href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent-teal)", textDecoration: "none", fontFamily: "var(--font-mono)" }}
                      >
                        <ExternalLink size={12} /> Tx {i + 1}: {sig.slice(0, 28)}…
                      </a>
                    ))}
                  </div>
                )}

                <Button
                  variant="teal"
                  size="md"
                  icon={<Zap size={16} />}
                  loading={disburseStep === "sending"}
                  disabled={!isRegistered || !client || disburseStep === "sending" || disburseStep === "done"}
                  onClick={handleDisburse}
                  style={{ width: "100%" }}
                >
                  Disburse via UTXO Mixer
                </Button>

                <div style={{ marginTop: 10, borderTop: "1px solid var(--border-subtle)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Waves size={15} style={{ color: "var(--accent-violet)" }} />
                    <p style={{ fontSize: 13, fontWeight: 600 }}>Private Stream</p>
                  </div>

                  {stream ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.3)" }}>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        Status: <strong>{stream.status}</strong> · Claimable now: <strong>{formatTokenAmount(stream.runtime.claimableAmountRaw)}</strong>
                      </p>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        Total: {formatTokenAmount(stream.totalAmountRaw)} · Claimed: {formatTokenAmount(stream.claimedAmountRaw)}
                      </p>
                      {(isAdmin || isCreator) && stream.status === "active" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={streamCancelling}
                          onClick={handleCancelStream}
                          style={{ width: "100%" }}
                        >
                          Cancel Stream
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>
                      <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        Convert this approved payout into a time-based private stream.
                      </p>
                      <div style={{ display: "grid", gap: 8 }}>
                        <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          Start
                          <input
                            type="datetime-local"
                            value={streamStartAt}
                            onChange={(e) => setStreamStartAt(e.target.value)}
                            style={{ width: "100%", marginTop: 4, background: "rgba(14,14,26,0.8)", border: "1px solid var(--border-subtle)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px" }}
                          />
                        </label>
                        <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          Cliff
                          <input
                            type="datetime-local"
                            value={streamCliffAt}
                            onChange={(e) => setStreamCliffAt(e.target.value)}
                            style={{ width: "100%", marginTop: 4, background: "rgba(14,14,26,0.8)", border: "1px solid var(--border-subtle)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px" }}
                          />
                        </label>
                        <label style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          End
                          <input
                            type="datetime-local"
                            value={streamEndAt}
                            onChange={(e) => setStreamEndAt(e.target.value)}
                            style={{ width: "100%", marginTop: 4, background: "rgba(14,14,26,0.8)", border: "1px solid var(--border-subtle)", borderRadius: 8, color: "var(--text-primary)", padding: "8px 10px" }}
                          />
                        </label>
                      </div>
                      <Button
                        variant="secondary"
                        size="md"
                        icon={<Waves size={15} />}
                        loading={streamSaving}
                        disabled={streamSaving || !(isAdmin || isCreator)}
                        onClick={handleCreateStream}
                        style={{ width: "100%" }}
                      >
                        Create Private Stream
                      </Button>
                      {!(isAdmin || isCreator) && (
                        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          Only the creator/admin can create a stream for this proposal.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  Disbursement is unlocked once a proposal is approved. Vote and approve the proposal on the left to proceed.
                </p>
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(107,100,144,0.12)", border: "1px solid var(--border-subtle)", fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Lock size={13} /> Waiting for approval
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* ZK solvency detail */}
        {proposal.zkSolvencyProof && (
          <Card style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 24px" }}>
            <ShieldCheck size={20} style={{ color: "var(--accent-violet)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>ZK Solvency Proof</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Simulated proof that the DAO treasury has sufficient encrypted balance to fund this proposal — without revealing the amount.
              </p>
            </div>
            <code style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent-violet-light)", background: "rgba(124,58,237,0.1)", padding: "4px 10px", borderRadius: 6 }}>
              {proposal.zkSolvencyProof}
            </code>
          </Card>
        )}
      </motion.div>
    </AppShell>
  );
}

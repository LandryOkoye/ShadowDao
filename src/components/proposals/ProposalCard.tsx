"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, CheckCircle, Zap, FileText, ThumbsUp, ThumbsDown, Lock } from "lucide-react";
import { Card, Badge } from "@/components/ui/primitives";
import type { Proposal } from "@/lib/store/proposals";
import { tallyVotes } from "@/lib/store/proposals";

const STATUS_CONFIG = {
  draft:     { label: "Draft",     variant: "gray"   as const, icon: <FileText size={12} /> },
  active:    { label: "Active",    variant: "violet" as const, icon: <Clock size={12} />, dot: true },
  approved:  { label: "Approved",  variant: "green"  as const, icon: <CheckCircle size={12} /> },
  disbursed: { label: "Disbursed", variant: "teal"   as const, icon: <Zap size={12} /> },
  rejected:  { label: "Rejected",  variant: "red"    as const, icon: <FileText size={12} /> },
};

export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const tally = tallyVotes(proposal);
  const cfg = STATUS_CONFIG[proposal.status];
  const yesPercent = tally.total > 0 ? Math.round((tally.yes / tally.total) * 100) : 0;

  return (
    <Link href={`/proposals/${proposal.id}`} style={{ textDecoration: "none" }}>
      <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
        <Card style={{ display: "flex", flexDirection: "column", gap: 16, cursor: "pointer" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, flex: 1 }}>
              {proposal.title}
            </h3>
            <Badge variant={cfg.variant} dot={"dot" in cfg ? cfg.dot : false}>
              {cfg.icon} {cfg.label}
            </Badge>
          </div>

          {/* Description */}
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {proposal.description}
          </p>

          {/* Amount + ZK badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Lock size={12} style={{ color: "var(--accent-violet)" }} />
            <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              Amount: <span style={{ color: "var(--accent-violet-light)" }}>Confidential</span>
            </span>
            {proposal.zkSolvencyProof && (
              <Badge variant="violet" style={{ fontSize: 11 }}>ZK Solvency ✓</Badge>
            )}
          </div>

          {/* Vote bar */}
          {tally.total > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--success)" }}>
                  <ThumbsUp size={11} /> {tally.yes} Yes
                </span>
                <span style={{ color: "var(--text-muted)" }}>{tally.total} votes</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--error)" }}>
                  {tally.no} No <ThumbsDown size={11} />
                </span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${yesPercent}%` }}
                  style={{ height: "100%", background: "var(--accent-primary)", borderRadius: 4 }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 12 }}>
            <span>{new Date(proposal.createdAt).toLocaleDateString()}</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>
              {proposal.createdBy.slice(0, 6)}…{proposal.createdBy.slice(-4)}
            </span>
          </div>
        </Card>
      </motion.div>
    </Link>
  );
}

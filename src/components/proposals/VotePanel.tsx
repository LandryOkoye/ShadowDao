"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ThumbsUp, ThumbsDown, CheckCircle, Zap } from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";
import {
  castVote,
  approveProposal,
  tallyVotes,
  hasReachedQuorum,
  type Proposal,
} from "@/lib/store/proposals";
import { QUORUM_MIN_VOTES, QUORUM_THRESHOLD } from "@/lib/utils/constants";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/components/ui/Toast";

interface Props {
  proposal: Proposal;
  onUpdate: (p: Proposal) => void;
  isAdmin?: boolean;
}

export function VotePanel({ proposal, onUpdate, isAdmin = false }: Props) {
  const wallet = useWallet();
  const { success, error, warning } = useToast();
  const [loading, setLoading] = useState<"yes" | "no" | "approve" | null>(null);

  const address = wallet.publicKey?.toBase58() ?? "";
  const tally = tallyVotes(proposal);
  const myVote = proposal.votes.find(v => v.voter === address);
  const yesPercent = Math.round(tally.yesPercent * 100);

  const quorumMet = hasReachedQuorum(proposal, QUORUM_MIN_VOTES, QUORUM_THRESHOLD);
  const canApprove =
    proposal.status === "active" &&
    (isAdmin || quorumMet);

  const vote = async (choice: "yes" | "no") => {
    if (!address) { error("Wallet not connected"); return; }
    if (proposal.status !== "active") { warning("Voting closed"); return; }
    setLoading(choice);
    try {
      const updated = await castVote(proposal.id, address, choice);
      success(`Voted ${choice.toUpperCase()}`, "Your vote is recorded.");
      onUpdate(updated);
    } catch (e) {
      error("Vote failed", String(e));
    } finally {
      setLoading(null);
    }
  };

  const approve = async () => {
    setLoading("approve");
    try {
      const updated = await approveProposal(proposal.id);
      success("Proposal approved!", "Ready for disbursement.");
      onUpdate(updated);
    } catch (e) {
      error("Approval failed", String(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Vote tally */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
          <span style={{ color: "var(--success)", fontWeight: 600 }}>{tally.yes} Yes ({yesPercent}%)</span>
          <span style={{ color: "var(--text-muted)" }}>{tally.total} total votes</span>
          <span style={{ color: "var(--error)", fontWeight: 600 }}>{tally.no} No ({100 - yesPercent}%)</span>
        </div>
        <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${yesPercent}%` }}
            transition={{ duration: 0.8 }}
            style={{
              height: "100%",
              background: "var(--accent-primary)",
              borderRadius: 8,
            }}
          />
        </div>
      </div>

      {/* Quorum status */}
      {proposal.status === "active" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Badge variant={quorumMet ? "green" : "gray"} dot={quorumMet}>
            {quorumMet
              ? "Quorum reached — approvable"
              : `Quorum: ${tally.yes}/${QUORUM_MIN_VOTES} min vote(s), ${yesPercent}%/${Math.round(QUORUM_THRESHOLD * 100)}% threshold`}
          </Badge>
        </div>
      )}

      {/* My vote badge */}
      {myVote && (
        <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          Your vote: <Badge variant={myVote.choice === "yes" ? "green" : "red"}>{myVote.choice.toUpperCase()}</Badge>
        </div>
      )}

      {/* Vote buttons */}
      {proposal.status === "active" && (
        <div style={{ display: "flex", gap: 12 }}>
          <Button
            variant={myVote?.choice === "yes" ? "teal" : "secondary"}
            size="md"
            icon={<ThumbsUp size={15} />}
            loading={loading === "yes"}
            onClick={() => vote("yes")}
            style={{ flex: 1 }}
          >
            Vote Yes
          </Button>
          <Button
            variant={myVote?.choice === "no" ? "danger" : "ghost"}
            size="md"
            icon={<ThumbsDown size={15} />}
            loading={loading === "no"}
            onClick={() => vote("no")}
            style={{ flex: 1 }}
          >
            Vote No
          </Button>
        </div>
      )}

      {/* Approve — visible to admins OR when quorum is met */}
      {canApprove && (
        <Button
          variant="primary"
          size="md"
          icon={quorumMet ? <Zap size={16} /> : <CheckCircle size={16} />}
          loading={loading === "approve"}
          onClick={approve}
          style={{ width: "100%" }}
        >
          {isAdmin && !quorumMet
            ? "Approve Proposal (Admin Override)"
            : "Approve Proposal"}
        </Button>
      )}
    </div>
  );
}

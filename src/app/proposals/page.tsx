"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ScrollText, Plus, Search } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button, Badge } from "@/components/ui/primitives";
import { ProposalCard } from "@/components/proposals/ProposalCard";
import { CreateProposalModal } from "@/components/proposals/CreateProposalModal";
import { getProposals, type Proposal, type ProposalStatus } from "@/lib/store/proposals";
import { useWallet } from "@solana/wallet-adapter-react";

const FILTERS: { label: string; value: ProposalStatus | "all" }[] = [
  { label: "All",       value: "all" },
  { label: "Active",    value: "active" },
  { label: "Approved",  value: "approved" },
  { label: "Disbursed", value: "disbursed" },
  { label: "Rejected",  value: "rejected" },
];

export default function ProposalsPage() {
  const wallet = useWallet();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filter, setFilter] = useState<ProposalStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      setProposals(await getProposals());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
      setProposals([]);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const filtered = proposals.filter(p => {
    const matchStatus = filter === "all" || p.status === filter;
    const matchSearch = !search ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <ScrollText size={26} style={{ color: "var(--accent-violet)" }} />
              <h1 style={{ fontSize: 26, fontWeight: 700 }}>Proposals</h1>
              <Badge variant="violet">{proposals.length}</Badge>
            </div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Create and vote on confidential funding proposals.
            </p>
          </div>
          {wallet.connected && (
            <Button variant="primary" size="md" icon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
              New Proposal
            </Button>
          )}
        </div>

        {/* Search + Filters */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search box */}
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={14} style={{
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
              color: "var(--text-muted)", pointerEvents: "none",
            }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search proposals…"
              style={{
                width: "100%", padding: "9px 14px 9px 36px",
                background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
                borderRadius: 10, color: "var(--text-primary)", fontSize: 14,
                fontFamily: "var(--font-sans)", outline: "none",
              }}
            />
          </div>

          {/* Status filters */}
          <div style={{ display: "flex", gap: 6 }}>
            {FILTERS.map(f => (
              <button key={f.value} onClick={() => setFilter(f.value)}
                style={{
                  padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                  fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13,
                  background: filter === f.value ? "rgba(124,58,237,0.2)" : "var(--bg-elevated)",
                  color: filter === f.value ? "var(--accent-violet-light)" : "var(--text-secondary)",
                  border: filter === f.value ? "1px solid rgba(124,58,237,0.4)" : "1px solid var(--border-subtle)",
                  transition: "all 0.18s",
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loadError ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--error)", fontSize: 14 }}>
            {loadError}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <ScrollText size={36} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <p style={{ fontSize: 15 }}>
              {proposals.length === 0 ? "No proposals yet — create the first one!" : "No proposals match your filter."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {filtered.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <ProposalCard proposal={p} />
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <CreateProposalModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={load} />
    </AppShell>
  );
}

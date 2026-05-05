"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LayoutDashboard, ArrowRight, Vault, ScrollText, ShieldCheck, Activity } from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { Card, Badge, Button } from "@/components/ui/primitives";
import { useUmbra } from "@/contexts/UmbraContext";
import { useWallet } from "@solana/wallet-adapter-react";
import { getProposals } from "@/lib/store/proposals";

const QUICK_LINKS = [
  { href: "/treasury",   label: "Treasury",   desc: "Shield & disburse funds",          icon: <Vault size={20} />,       color: "#7c3aed" },
  { href: "/proposals",  label: "Proposals",  desc: "Create & vote on funding",          icon: <ScrollText size={20} />,  color: "#14b8a6" },
  { href: "/compliance", label: "Compliance", desc: "Manage auditor access",             icon: <ShieldCheck size={20} />, color: "#ec4899" },
];

export default function DashboardPage() {
  const { isRegistered, isAnonymous, isInitialising } = useUmbra();
  const wallet = useWallet();
  const [proposalStats, setProposalStats] = useState({ total: 0, active: 0 });

  useEffect(() => {
    let mounted = true;
    getProposals()
      .then((all) => {
        if (!mounted) return;
        setProposalStats({
          total: all.length,
          active: all.filter((p) => p.status === "active").length,
        });
      })
      .catch(() => {
        if (mounted) setProposalStats({ total: 0, active: 0 });
      });
    return () => {
      mounted = false;
    };
  }, []);

  const address = wallet.publicKey?.toBase58() ?? "";

  return (
    <AppShell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {/* Header */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <LayoutDashboard size={26} style={{ color: "var(--accent-violet)" }} />
            <h1 style={{ fontSize: 26, fontWeight: 700 }}>Dashboard</h1>
          </div>
          {address && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {address.slice(0, 8)}…{address.slice(-6)}
            </p>
          )}
        </div>

        {/* Registration alert */}
        {!isInitialising && !isRegistered && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <p style={{ fontWeight: 600, color: "#fbbf24", marginBottom: 2 }}>Umbra Registration Required</p>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Register to access treasury deposits, anonymous disbursements, and compliance features.</p>
            </div>
            <Link href="/register" style={{ textDecoration: "none", flexShrink: 0 }}>
              <Button variant="primary" size="sm" icon={<ArrowRight size={14} />}>Register</Button>
            </Link>
          </motion.div>
        )}

        {/* Status cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {[
            { label: "Umbra Status",      value: isInitialising ? "Checking…" : isRegistered ? "Registered" : "Unregistered", variant: isRegistered ? "teal" as const : "gray" as const },
            { label: "Privacy Mode",       value: isAnonymous ? "Anonymous" : "Standard",  variant: isAnonymous ? "violet" as const : "gray" as const },
            { label: "Total Proposals",   value: String(proposalStats.total), variant: "violet" as const },
            { label: "Active Proposals",  value: String(proposalStats.active),   variant: proposalStats.active > 0 ? "yellow" as const : "gray" as const },
          ].map(stat => (
            <Card key={stat.label} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{stat.label}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={16} style={{ color: "var(--accent-violet)", opacity: 0.6 }} />
                <Badge variant={stat.variant} dot>{stat.value}</Badge>
              </div>
            </Card>
          ))}
        </div>

        {/* Quick links */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "var(--text-secondary)" }}>Quick Actions</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {QUICK_LINKS.map(link => (
              <Link key={link.href} href={link.href} style={{ textDecoration: "none" }}>
                <motion.div whileHover={{ y: -3 }} className="glass"
                  style={{ padding: "20px 24px", borderRadius: 16, cursor: "pointer", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${link.color}18`, border: `1px solid ${link.color}30`, display: "flex", alignItems: "center", justifyContent: "center", color: link.color }}>
                    {link.icon}
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15, fontFamily: "var(--font-display)" }}>{link.label}</p>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{link.desc}</p>
                  </div>
                  <ArrowRight size={16} style={{ color: "var(--text-muted)", alignSelf: "flex-end" }} />
                </motion.div>
              </Link>
            ))}
          </div>
        </div>

        {/* Network info */}
        <Card style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[
            { label: "Network", value: "Solana Devnet" },
            { label: "Privacy Layer", value: "Umbra Protocol" },
            { label: "MPC Engine", value: "Arcium" },
            { label: "Explorer", value: "Solana Explorer ↗", href: "https://explorer.solana.com/?cluster=devnet" },
          ].map(item => (
            <div key={item.label}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{item.label}</p>
              {item.href ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: "var(--accent-teal)", textDecoration: "none", fontWeight: 600 }}>{item.value}</a>
              ) : (
                <p style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)", color: "var(--text-primary)" }}>{item.value}</p>
              )}
            </div>
          ))}
        </Card>
      </motion.div>
    </AppShell>
  );
}

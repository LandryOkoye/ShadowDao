"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Shield, Vault, ScrollText, ShieldCheck, ArrowRight, Lock, Zap, Eye } from "lucide-react";
import { Button, Badge, Card } from "@/components/ui/primitives";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/utils/constants";

const FEATURES = [
  {
    icon: <Vault size={24} />,
    title: "Shielded Treasury",
    description: "Deposit SPL tokens into Umbra's encrypted balance. Your treasury holdings are cryptographically hidden — even from your counterparty.",
  },
  {
    icon: <Zap size={24} />,
    title: "Anonymous Disbursements",
    description: "Route approved payments through the Umbra UTXO mixer. Recipients receive funds with zero linkability to the sender.",
  },
  {
    icon: <ScrollText size={24} />,
    title: "Private Governance",
    description: "Create and vote on funding proposals without revealing amounts. ZK solvency proofs confirm the DAO can pay without exposing balances.",
  },
  {
    icon: <ShieldCheck size={24} />,
    title: "Selective Compliance",
    description: "Grant time-boxed viewing key access to auditors. Revoke at any time. Full on-chain auditability with minimal disclosure.",
  },
];

const STATS = [
  { label: "Privacy Layer", value: "Umbra SDK" },
  { label: "Network", value: "Solana Devnet" },
  { label: "MPC Engine", value: "Arcium" },
  { label: "ZK Proofs", value: "Web-native" },
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Nav bar */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        height: 72,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 max(24px, 5vw)",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-overlay)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, var(--bg-elevated), var(--bg-surface))",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "var(--shadow-sm)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
          }}>
            <Image
              src="/Gemini_Generated_Image-removebg.png"
              alt="ShadowDAO logo"
              width={24}
              height={24}
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
          <span style={{ 
            fontFamily: "var(--font-sans)", 
            fontWeight: 700, 
            letterSpacing: "-0.02em",
            fontSize: 18, 
            color: "var(--text-primary)" 
          }}>
            {APP_NAME}
          </span>
        </div>
        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          <Button variant="primary" size="sm">
            Launch App <ArrowRight size={14} style={{ marginLeft: 4 }} />
          </Button>
        </Link>
      </nav>

      {/* Hero */}
      <section style={{ 
        position: "relative", 
        padding: "120px 24px 80px", 
        textAlign: "center",
        maxWidth: 1000,
        margin: "0 auto",
      }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
          <Badge variant="gray" dot style={{ marginBottom: 24, fontSize: 13, padding: "6px 14px" }}>
            Powered by Umbra Privacy Protocol
          </Badge>

          <h1 style={{
            fontSize: "clamp(48px, 8vw, 88px)",
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            marginBottom: 24,
            color: "var(--text-primary)",
          }}>
            Private Governance<br />
            <span style={{ color: "var(--text-muted)" }}>for the Onchain World</span>
          </h1>

          <p style={{ 
            fontSize: 20, 
            color: "var(--text-secondary)", 
            maxWidth: 640, 
            margin: "0 auto 48px", 
            lineHeight: 1.6,
            fontWeight: 400
          }}>
            {APP_DESCRIPTION}
          </p>

          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/dashboard" style={{ textDecoration: "none" }}>
              <Button variant="primary" size="lg" icon={<Shield size={18} />}>
                Launch ShadowDAO
              </Button>
            </Link>
            <Link href="/register" style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="lg" icon={<Lock size={18} />}>
                Register with Umbra
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Stats bar */}
      <section style={{ 
        borderTop: "1px solid var(--border-subtle)", 
        borderBottom: "1px solid var(--border-subtle)", 
        background: "var(--bg-surface)" 
      }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          style={{
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            maxWidth: 1200, 
            margin: "0 auto",
          }}
        >
          {STATS.map((s, i) => (
            <div key={s.label} style={{ 
              padding: "32px 24px", 
              textAlign: "center",
              borderRight: i !== STATS.length - 1 ? "1px solid var(--border-subtle)" : "none",
            }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: "var(--text-primary)" }}>
                {s.value}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, fontWeight: 500 }}>
                {s.label}
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section style={{ padding: "120px 24px", maxWidth: 1200, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <h2 style={{ fontSize: 36, marginBottom: 16, fontWeight: 600 }}>
            Built for Privacy
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 64, fontSize: 18, maxWidth: 600 }}>
            Every workflow is cryptographically private by default. Govern and manage your treasury securely.
          </p>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Card style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: "var(--bg-base)",
                  border: "1px solid var(--border-strong)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--text-primary)", marginBottom: 24,
                }}>
                  {f.icon}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 600 }}>{f.title}</h3>
                </div>
                <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6, flexGrow: 1 }}>
                  {f.description}
                </p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "80px 24px 120px", textAlign: "center" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ 
            margin: "0 auto", 
            padding: "64px 40px", 
            borderRadius: "var(--radius-xl)",
            background: "var(--bg-surface)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            boxShadow: "var(--shadow-md)",
            backdropFilter: "blur(12px)",
          }}
        >
          <Eye size={40} style={{ color: "var(--text-primary)", margin: "0 auto 24px" }} />
          <h2 style={{ fontSize: 32, marginBottom: 16, fontWeight: 600 }}>Start Governing Privately</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 32, fontSize: 16, maxWidth: 500, margin: "0 auto 32px" }}>
            Connect a Solana wallet, register with Umbra, and make your first shielded treasury deposit.
          </p>
          <Link href="/register" style={{ textDecoration: "none" }}>
            <Button variant="primary" size="lg">
              Get Started <ArrowRight size={16} style={{ marginLeft: 6 }} />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer style={{ 
        borderTop: "1px solid var(--border-subtle)", 
        padding: "32px 24px", 
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16
      }}>
        <div style={{
            width: 24, height: 24, borderRadius: 6,
            background: "linear-gradient(135deg, var(--bg-elevated), var(--bg-surface))",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "var(--shadow-sm)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
          }}>
            <Image
              src="/Gemini_Generated_Image-removebg.png"
              alt="ShadowDAO logo"
              width={18}
              height={18}
              style={{ objectFit: "contain" }}
            />
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          ShadowDAO · Built with Umbra Privacy Protocol · Solana Devnet · Hackathon MVP
        </p>
      </footer>
    </div>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Vault,
  ScrollText,
  Waves,
  Siren,
  ShieldCheck,
  UserCheck,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { useUmbra } from "@/contexts/UmbraContext";

const NAV_ITEMS = [
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { href: "/treasury",    label: "Treasury",    icon: Vault },
  { href: "/proposals",   label: "Proposals",   icon: ScrollText },
  { href: "/streams",     label: "Streams",     icon: Waves },
  { href: "/panic",       label: "Panic",       icon: Siren },
  { href: "/compliance",  label: "Compliance",  icon: ShieldCheck },
  { href: "/register",    label: "Register",    icon: UserCheck },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { isRegistered } = useUmbra();

  return (
    <aside style={{
      width: 240,
      minHeight: "100vh",
      background: "rgba(10,10,18,0.95)",
      borderRight: "1px solid var(--border-subtle)",
      display: "flex",
      flexDirection: "column",
      padding: "24px 16px",
      flexShrink: 0,
      position: "sticky",
      top: 0,
    }}>
      {/* Logo */}
      <Link href="/" style={{ textDecoration: "none", marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, var(--bg-elevated), var(--bg-surface))",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "var(--shadow-sm)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, color: "var(--text-primary)",
          }}>S</div>
          <span style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}>ShadowDAO</span>
        </div>
      </Link>

      {/* Navigation */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} style={{ textDecoration: "none" }} onClick={onClose}>
              <motion.div
                whileHover={{ x: 3 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: active ? "var(--bg-elevated)" : "transparent",
                  border: active ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid transparent",
                  boxShadow: active ? "var(--shadow-sm)" : "none",
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: 3,
                      background: "var(--text-primary)",
                      borderRadius: "0 2px 2px 0",
                    }}
                  />
                )}
                <Icon size={18} />
                <span style={{ fontSize: 14, fontWeight: active ? 600 : 400, fontFamily: "var(--font-display)" }}>
                  {label}
                </span>
                {href === "/register" && (
                  <AnimatePresence>
                    {!isRegistered && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        style={{ marginLeft: "auto" }}
                      >
                        <Badge variant="yellow" dot>!</Badge>
                      </motion.span>
                    )}
                  </AnimatePresence>
                )}
                {active && <ChevronRight size={14} style={{ marginLeft: "auto", opacity: 0.6 }} />}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Footer status */}
      <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
          <Badge variant={isRegistered ? "teal" : "gray"} dot>
            {isRegistered ? "Registered" : "Unregistered"}
          </Badge>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Solana Devnet</p>
      </div>
    </aside>
  );
}

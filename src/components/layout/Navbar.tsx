"use client";

import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useUmbra } from "@/contexts/UmbraContext";
import { Badge, Spinner } from "@/components/ui/primitives";
import { Shield, Menu } from "lucide-react";

interface NavbarProps {
  /** If provided, a hamburger icon button is rendered (mobile mode) */
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { isRegistered, isAnonymous, isInitialising } = useUmbra();

  return (
    <header style={{
      height: 64,
      borderBottom: "1px solid var(--border-subtle)",
      background: "rgba(7,7,15,0.9)",
      backdropFilter: "blur(16px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      padding: "0 20px",
      gap: 16,
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      {/* Hamburger — mobile only */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          style={{
            marginRight: "auto",
            background: "transparent",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "6px 8px",
            cursor: "pointer",
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "center",
          }}
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>
      )}

      {isInitialising && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
          <Spinner size={16} />
          Initialising Umbra…
        </div>
      )}

      {!isInitialising && isRegistered && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Shield size={14} style={{ color: "var(--accent-teal)" }} />
          <Badge variant={isAnonymous ? "teal" : "violet"} dot>
            {isAnonymous ? "Anonymous" : "Verified Member"}
          </Badge>
        </div>
      )}

      {/* Wallet Adapter Button — inherits global Solana adapter styles */}
      <WalletMultiButton style={{
        background: "var(--bg-elevated)",
        color: "var(--text-primary)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "var(--shadow-sm)",
        borderRadius: 10,
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        fontSize: 14,
        padding: "8px 18px",
        height: 40,
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }} />
    </header>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getPanicState, type PanicPolicy } from "@/lib/store/panic";

export function PanicBanner() {
  const [policy, setPolicy] = useState<PanicPolicy | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPanicState(1)
      .then((state) => {
        if (!cancelled) setPolicy(state.policy);
      })
      .catch(() => {
        if (!cancelled) setPolicy(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!policy?.isArmed) return null;

  return (
    <div
      style={{
        margin: "0 0 12px",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(245,158,11,0.45)",
        background: "rgba(245,158,11,0.12)",
        color: "#fde68a",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <AlertTriangle size={14} />
        Panic Mode Active: disbursements are restricted to safety recipients.
      </span>
      <Link href="/panic" style={{ color: "#fef3c7", fontSize: 13, textDecoration: "none" }}>
        Open Controls
      </Link>
    </div>
  );
}


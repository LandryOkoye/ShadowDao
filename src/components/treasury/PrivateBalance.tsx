"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, RefreshCw, TrendingUp } from "lucide-react";
import { Card, Badge, Button, Spinner } from "@/components/ui/primitives";
import { useUmbra } from "@/contexts/UmbraContext";
import { queryEncryptedBalance } from "@/lib/umbra/query";
import { USDC_MINT } from "@/lib/utils/constants";
import { useToast } from "@/components/ui/Toast";

export function PrivateBalance() {
  const { client } = useUmbra();
  const { error } = useToast();
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [balanceData, setBalanceData] = useState<{ state: string; amount?: string } | null>(null);

  const fetchBalance = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const result = await queryEncryptedBalance(client, [USDC_MINT]);
      const entry = result?.get(USDC_MINT);
      if (entry) {
        if (entry.state === "shared") {
          // balance is U64 (branded bigint)
          setBalanceData({ state: "shared", amount: String(entry.balance) });
        } else {
          // "mxe" | "uninitialized" | "non_existent"
          setBalanceData({ state: entry.state });
        }
      } else {
        setBalanceData({ state: "non_existent" });
      }
    } catch (e) {
      error("Balance fetch failed", String(e));
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount/client change, then auto-refresh every 30 seconds
  useEffect(() => {
    void Promise.resolve().then(fetchBalance);
    if (!client) return;
    const interval = setInterval(fetchBalance, 30_000);
    return () => clearInterval(interval);
  }, [client]); // eslint-disable-line

  const isMxe = balanceData?.state === "mxe";
  const isShared = balanceData?.state === "shared";
  const displayAmount = isShared && balanceData?.amount
    ? `${(Number(balanceData.amount) / 1_000_000).toFixed(2)} USDC`
    : "0.00 USDC";

  return (
    <Card elevated style={{ position: "relative", overflow: "hidden" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Private Treasury Balance
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <TrendingUp size={14} style={{ color: "var(--accent-teal)" }} />
            <Badge variant="teal">USDC · Devnet</Badge>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isShared && (
            <Button variant="ghost" size="sm" icon={revealed ? <EyeOff size={14} /> : <Eye size={14} />}
              onClick={() => setRevealed(r => !r)}>
              {revealed ? "Hide" : "Reveal"}
            </Button>
          )}
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} loading={loading} onClick={fetchBalance} />
        </div>
      </div>

      {/* Balance display */}
      <div style={{ margin: "12px 0 20px" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Spinner size={20} />
            <span style={{ color: "var(--text-muted)", fontSize: 14 }}>Querying encrypted state…</span>
          </div>
        ) : (
          <motion.div
            key={revealed ? "revealed" : "hidden"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {isMxe || !revealed ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="shimmer-text" style={{ fontSize: 40, fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "-0.03em" }}>
                  {isMxe ? "● ● ● ●" : "* * * * *"}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: 40, fontFamily: "var(--font-display)", fontWeight: 700, color: "var(--accent-teal-light)" }}>
                {displayAmount}
              </span>
            )}
          </motion.div>
        )}
      </div>

      {/* Status badge */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {isMxe ? (
          <Badge variant="violet" dot>MXE — Arcium MPC Shielded</Badge>
        ) : (
          <Badge variant="teal" dot>Encrypted · On-chain</Badge>
        )}
        <Badge variant="gray">Umbra Protocol</Badge>
      </div>
    </Card>
  );
}

"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ─── Icons & colours ─────────────────────────────────────────────────────────
const CONFIG: Record<ToastType, { icon: ReactNode; color: string; bg: string }> = {
  success: { icon: <CheckCircle size={18} />, color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  error:   { icon: <XCircle    size={18} />, color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
  warning: { icon: <AlertCircle size={18} />, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  info:    { icon: <Info       size={18} />, color: "#7c3aed", bg: "rgba(124,58,237,0.12)"  },
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    toast,
    success: (t, m) => toast("success", t, m),
    error:   (t, m) => toast("error", t, m),
    warning: (t, m) => toast("warning", t, m),
    info:    (t, m) => toast("info", t, m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map((t) => {
            const cfg = CONFIG[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 60, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                style={{
                  background: "rgba(14,14,26,0.95)",
                  border: `1px solid ${cfg.color}30`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  maxWidth: 360,
                  boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px ${cfg.color}15`,
                  backdropFilter: "blur(16px)",
                }}
              >
                <span style={{ color: cfg.color, marginTop: 1, flexShrink: 0 }}>{cfg.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
                    {t.title}
                  </p>
                  {t.message && (
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                      {t.message}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none", padding: 0, flexShrink: 0 }}
                >
                  <X size={15} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

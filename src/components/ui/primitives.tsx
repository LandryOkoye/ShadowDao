"use client";

import React from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

// ─── Button ──────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "teal";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
    background: "var(--accent-primary)",
    color: "var(--bg-base)",
    border: "1px solid var(--accent-primary)",
    boxShadow: "var(--shadow-sm)",
  },
  secondary: {
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-strong)",
    boxShadow: "var(--shadow-sm)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid transparent",
  },
  danger: {
    background: "rgba(239, 68, 68, 0.1)",
    color: "var(--error)",
    border: "1px solid rgba(239, 68, 68, 0.2)",
  },
  teal: {
    background: "var(--accent-brand)",
    color: "#ffffff",
    border: "1px solid var(--accent-brand)",
    boxShadow: "var(--shadow-sm)",
  },
};

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { padding: "6px 12px", fontSize: 13, borderRadius: "var(--radius-sm)" },
  md: { padding: "8px 16px", fontSize: 14, borderRadius: "var(--radius-md)" },
  lg: { padding: "12px 24px", fontSize: 15, borderRadius: "var(--radius-md)" },
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.01, y: disabled || loading ? 0 : -1 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98, y: 0 }}
      {...(props as React.ComponentProps<typeof motion.button>)}
      disabled={disabled || loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.6 : 1,
        transition: "background 0.2s, color 0.2s, border-color 0.2s",
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
    >
      {loading ? <Loader2 size={16} className="animate-spin-slow" /> : icon}
      {children}
    </motion.button>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export function Card({ children, className = "", elevated = false, style, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`${elevated ? "glass-elevated" : "glass"} ${className}`}
      style={{ 
        padding: "24px", 
        cursor: onClick ? "pointer" : "default", 
        transition: "border-color 0.2s, transform 0.2s",
        ...style 
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = "var(--border-strong)";
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "var(--shadow-md)";
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = elevated ? "var(--shadow-md)" : "var(--shadow-sm)";
        }
      }}
    >
      {children}
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────
type BadgeVariant = "violet" | "teal" | "pink" | "green" | "yellow" | "red" | "gray";

// Re-mapped to professional minimalist colors
const badgeColors: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  violet: { bg: "var(--bg-elevated)", color: "var(--text-primary)", border: "var(--border-strong)" },
  teal:   { bg: "rgba(59, 130, 246, 0.1)", color: "var(--accent-brand)", border: "rgba(59, 130, 246, 0.2)" }, // Brand blue
  pink:   { bg: "var(--bg-elevated)", color: "var(--text-secondary)", border: "var(--border-subtle)" }, // Muted fallback
  green:  { bg: "rgba(16, 185, 129, 0.1)",  color: "var(--success)", border: "rgba(16, 185, 129, 0.2)"  },
  yellow: { bg: "rgba(245, 158, 11, 0.1)", color: "var(--warning)", border: "rgba(245, 158, 11, 0.2)" },
  red:    { bg: "rgba(239, 68, 68, 0.1)",  color: "var(--error)", border: "rgba(239, 68, 68, 0.2)"  },
  gray:   { bg: "var(--bg-surface)", color: "var(--text-muted)", border: "var(--border-subtle)" },
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  style?: React.CSSProperties;
}

export function Badge({ children, variant = "violet", dot = false, style }: BadgeProps) {
  const c = badgeColors[variant];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "2px 8px",
      borderRadius: "var(--radius-sm)",
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: "0.01em",
      background: c.bg,
      color: c.color,
      border: `1px solid ${c.border}`,
      fontFamily: "var(--font-sans)",
      ...style,
    }}>
      {dot && (
        <span style={{
          width: 6, height: 6,
          borderRadius: "50%",
          background: c.color,
          display: "inline-block",
        }} />
      )}
      {children}
    </span>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
export function Spinner({ size = 20, color = "var(--text-secondary)" }: { size?: number; color?: string }) {
  return (
    <Loader2
      size={size}
      style={{ color, animation: "spin-slow 1s linear infinite" }}
    />
  );
}

// ─── Input ───────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, style, ...props }: InputProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>
          {label}
        </label>
      )}
      <input
        {...props}
        style={{
          background: "var(--bg-base)",
          border: error ? "1px solid var(--error)" : "1px solid var(--border-strong)",
          borderRadius: "var(--radius-md)",
          padding: "8px 12px",
          color: "var(--text-primary)",
          fontSize: 14,
          fontFamily: "var(--font-sans)",
          outline: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          width: "100%",
          ...style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--border-focus)";
          e.currentTarget.style.boxShadow = "0 0 0 1px var(--border-focus)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? "var(--error)" : "var(--border-strong)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      {error && <p style={{ fontSize: 12, color: "var(--error)" }}>{error}</p>}
      {hint && !error && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{hint}</p>}
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export function Textarea({ label, hint, style, ...props }: TextareaProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>
          {label}
        </label>
      )}
      <textarea
        {...props}
        style={{
          background: "var(--bg-base)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-md)",
          padding: "8px 12px",
          color: "var(--text-primary)",
          fontSize: 14,
          fontFamily: "var(--font-sans)",
          outline: "none",
          resize: "vertical",
          minHeight: 100,
          width: "100%",
          transition: "border-color 0.2s, box-shadow 0.2s",
          ...style,
        }}
        onFocus={(e) => { 
          e.currentTarget.style.borderColor = "var(--border-focus)";
          e.currentTarget.style.boxShadow = "0 0 0 1px var(--border-focus)";
        }}
        onBlur={(e)  => { 
          e.currentTarget.style.borderColor = "var(--border-strong)";
          e.currentTarget.style.boxShadow = "none";
        }}
      />
      {hint && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{hint}</p>}
    </div>
  );
}

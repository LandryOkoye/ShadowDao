"use client";

import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? "Unknown error" };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ShadowDAO ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          background: "var(--bg-base)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}>
          <div style={{
            background: "rgba(20,20,42,0.9)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 20,
            padding: "40px 48px",
            maxWidth: 520,
            textAlign: "center",
          }}>
            <AlertTriangle size={40} style={{ color: "#ef4444", margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#f0eeff", fontFamily: "var(--font-display)" }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: 14, color: "#a89fc8", marginBottom: 24, lineHeight: 1.7 }}>
              ShadowDAO encountered an unexpected error. This is usually a temporary issue — try refreshing the page.
            </p>
            {this.state.message && (
              <code style={{
                display: "block",
                fontSize: 12,
                color: "#f87171",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 8,
                padding: "8px 12px",
                marginBottom: 24,
                textAlign: "left",
                fontFamily: "var(--font-mono)",
                wordBreak: "break-word",
              }}>
                {this.state.message}
              </code>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 24px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-strong)",
                borderRadius: 10,
                color: "var(--text-primary)",
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={15} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

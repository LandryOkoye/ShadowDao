"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { PanicBanner } from "@/components/layout/PanicBanner";

/** Shared shell for all authenticated app pages.
 *  On mobile (< 768px) the sidebar collapses into a slide-in drawer
 *  triggered by the hamburger button in the Navbar.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (!e.matches) setSidebarOpen(false); // close drawer on resize up
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100vh", position: "relative" }}>
      {/* ── Desktop sidebar ── */}
      {!isMobile && <Sidebar />}

      {/* ── Mobile drawer backdrop ── */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 300,
          }}
        />
      )}

      {/* ── Mobile sidebar drawer ── */}
      {isMobile && (
        <div
          style={{
            position: "fixed",
            top: 0, left: 0, bottom: 0,
            width: 260,
            zIndex: 301,
            transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Navbar onMenuClick={isMobile ? () => setSidebarOpen(o => !o) : undefined} />
        <main style={{ flex: 1, padding: isMobile ? "20px 16px" : "32px 28px", maxWidth: 1200 }}>
          <PanicBanner />
          {children}
        </main>
      </div>
    </div>
  );
}

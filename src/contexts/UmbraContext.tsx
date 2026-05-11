"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getOrCreateUmbraClient, clearUmbraClient } from "@/lib/umbra/client";
import { checkRegistration } from "@/lib/umbra/registration";

type UmbraClient = Awaited<ReturnType<typeof getOrCreateUmbraClient>>;

interface UmbraContextValue {
  client: UmbraClient | null;
  isRegistered: boolean;
  isAnonymous: boolean;
  isInitialising: boolean;
  initError: string | null;
  initClient: () => Promise<void>;
  refreshRegistration: () => Promise<void>;
}

const UmbraContext = createContext<UmbraContextValue | null>(null);

export function useUmbra() {
  const ctx = useContext(UmbraContext);
  if (!ctx) throw new Error("useUmbra must be used inside <UmbraProvider>");
  return ctx;
}

export function UmbraProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const [client, setClient] = useState<UmbraClient | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isInitialising, setIsInitialising] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Cache last known address so we can clear the client even after publicKey goes null on disconnect
  const lastAddressRef = useRef<string | null>(null);

  const initClient = useCallback(async () => {
    if (!wallet.connected || !wallet.publicKey) return;
    setIsInitialising(true);
    setInitError(null);
    try {
      const c = await getOrCreateUmbraClient(wallet);
      lastAddressRef.current = wallet.publicKey.toBase58();
      setClient(c);
      const { isRegistered: reg, isAnonymous: anon } = await checkRegistration(
        c,
        wallet.publicKey.toBase58()
      );
      setIsRegistered(reg);
      setIsAnonymous(anon);
    } catch (err) {
      console.error("Umbra init error:", err);
      setInitError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsInitialising(false);
    }
  }, [wallet]);

  const refreshRegistration = useCallback(async () => {
    if (!client || !wallet.publicKey) return;
    const { isRegistered: reg, isAnonymous: anon } = await checkRegistration(
      client,
      wallet.publicKey.toBase58()
    );
    setIsRegistered(reg);
    setIsAnonymous(anon);
  }, [client, wallet.publicKey]);

  // Auto-init when wallet connects; clear safely when disconnected
  useEffect(() => {
    if (wallet.connected) {
      void Promise.resolve().then(initClient);
    } else {
      queueMicrotask(() => {
        // Use the cached address — wallet.publicKey may already be null at this point
        const address = lastAddressRef.current;
        if (address) {
          clearUmbraClient(address);
          lastAddressRef.current = null;
        }
        setClient(null);
        setIsRegistered(false);
        setIsAnonymous(false);
        setInitError(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.connected]);

  return (
    <UmbraContext.Provider
      value={{ client, isRegistered, isAnonymous, isInitialising, initError, initClient, refreshRegistration }}
    >
      {children}
    </UmbraContext.Provider>
  );
}

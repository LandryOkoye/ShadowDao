"use client";

import React, { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { RPC_URL } from "@/lib/utils/constants";
import { UmbraProvider } from "@/contexts/UmbraContext";
import { ToastProvider } from "@/components/ui/Toast";

// Import Solana wallet adapter CSS
import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <UmbraProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </UmbraProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

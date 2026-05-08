import type { Address } from "@solana/addresses";

// ─── Network ────────────────────────────────────────────────────────────────
// Umbra SDK Network type: "mainnet" | "devnet" | "localnet"
export const SOLANA_NETWORK =
  (process.env.NEXT_PUBLIC_SOLANA_NETWORK as "mainnet" | "devnet" | "localnet") ??
  "devnet";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

export const RPC_SUBSCRIPTIONS_URL =
  process.env.NEXT_PUBLIC_RPC_SUBSCRIPTIONS_URL ??
  "wss://api.devnet.solana.com";

// ─── Umbra ───────────────────────────────────────────────────────────────────
export const INDEXER_API_ENDPOINT =
  process.env.NEXT_PUBLIC_INDEXER_API_ENDPOINT ??
  "https://utxo-indexer.api.umbraprivacy.com";

// ─── Token Mints (Devnet) ────────────────────────────────────────────────────
// USDC on devnet (Circle's official devnet mint)
export const USDC_MINT = (
  process.env.NEXT_PUBLIC_USDC_MINT ??
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
) as Address;

// USDT on devnet (common test mint)
export const USDT_MINT = (
  process.env.NEXT_PUBLIC_USDT_MINT ??
  "EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS"
) as Address;

// Token list available in forms — add more mints here as needed
export interface TokenInfo {
  symbol: string;
  name: string;
  mint: Address;
  decimals: number;
}

export const TOKEN_LIST: TokenInfo[] = [
  { symbol: "USDC", name: "USD Coin",   mint: USDC_MINT, decimals: 6 },
  { symbol: "USDT", name: "USD Tether", mint: USDT_MINT, decimals: 6 },
];

// ─── UI ──────────────────────────────────────────────────────────────────────
export const APP_NAME = "ShadowDAO";
export const APP_DESCRIPTION =
  "Private-first governance & treasury on Solana, powered by Umbra privacy.";

// ─── Governance ───────────────────────────────────────────────────────────────
/** Minimum number of votes before a proposal can be approved */
export const QUORUM_MIN_VOTES = 1;
/** Fraction of yes-votes required to pass (0.5 = 50%) */
export const QUORUM_THRESHOLD = 0.5;

// ─── Admin ───────────────────────────────────────────────────────────────────
/** Wallet addresses that have admin privileges (approve proposals, etc.)
 *  Can be overridden via NEXT_PUBLIC_ADMIN_ADDRESSES (comma-separated). */
export const ADMIN_ADDRESSES: string[] = (
  process.env.NEXT_PUBLIC_ADMIN_ADDRESSES ?? ""
)
  .split(",")
  .map((a) => a.trim())
  .filter(Boolean);


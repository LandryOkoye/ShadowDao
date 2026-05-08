import { getUmbraClient } from "@umbra-privacy/sdk";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { createUmbraSigner } from "@/lib/utils/signer";
import {
  SOLANA_NETWORK,
  RPC_URL,
  RPC_SUBSCRIPTIONS_URL,
  INDEXER_API_ENDPOINT,
} from "@/lib/utils/constants";

// Module-level cache: one client per wallet address
const clientCache = new Map<string, Awaited<ReturnType<typeof getUmbraClient>>>();

/**
 * Returns a cached Umbra client for the connected wallet.
 * Creates a new one if none exists for this wallet address.
 *
 * Pass `deferMasterSeedSignature: true` to avoid prompting the user
 * for a signature at page load — the signature is requested lazily
 * when the first transaction is built.
 */
export async function getOrCreateUmbraClient(wallet: WalletContextState) {
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected.");
  }

  const address = wallet.publicKey.toBase58();

  if (clientCache.has(address)) {
    return clientCache.get(address)!;
  }

  const signer = createUmbraSigner(wallet);

  const client = await getUmbraClient({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signer: signer as any,
    network: SOLANA_NETWORK,
    rpcUrl: RPC_URL,
    rpcSubscriptionsUrl: RPC_SUBSCRIPTIONS_URL,
    indexerApiEndpoint: INDEXER_API_ENDPOINT,
    deferMasterSeedSignature: true,
  });

  clientCache.set(address, client);
  return client;
}

/** Clears the cached client (e.g. on wallet disconnect). */
export function clearUmbraClient(address: string) {
  clientCache.delete(address);
}

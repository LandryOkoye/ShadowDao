import {
  getEncryptedBalanceQuerierFunction,
  getUserAccountQuerierFunction,
} from "@umbra-privacy/sdk";
import type { Address } from "@solana/addresses";
import type { getOrCreateUmbraClient } from "@/lib/umbra/client";

type UmbraClient = Awaited<ReturnType<typeof getOrCreateUmbraClient>>;

/**
 * Query the encrypted (shielded) balance for one or more token mints.
 * Returns a Map<mint_address, result>.
 *
 * NOTE: If `result.state === "mxe"` the balance is held inside Arcium MPC
 * and is NOT readable client-side — display as "● ● ● ●".
 */
export async function queryEncryptedBalance(
  client: UmbraClient,
  mints: Address[]
) {
  const query = getEncryptedBalanceQuerierFunction({ client });
  return await query(mints);
}

/**
 * Query on-chain account metadata for any Umbra address.
 */
export async function queryUserAccount(
  client: UmbraClient,
  address: Address
) {
  const query = getUserAccountQuerierFunction({ client });
  try {
    return await query(address);
  } catch {
    return null;
  }
}

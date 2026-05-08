import {
  getUserRegistrationFunction,
  getUserAccountQuerierFunction,
} from "@umbra-privacy/sdk";
import { getUserRegistrationProver } from "@umbra-privacy/web-zk-prover";
import type { Address } from "@solana/addresses";
import type { getOrCreateUmbraClient } from "@/lib/umbra/client";

type UmbraClient = Awaited<ReturnType<typeof getOrCreateUmbraClient>>;
type RegisterOptions = Parameters<ReturnType<typeof getUserRegistrationFunction>>[0];

/**
 * Register the connected wallet as an Umbra member.
 * Sends up to 3 sequential on-chain transactions (account init, key init, proof).
 * Returns the array of transaction signatures.
 */
export async function registerUser(
  client: UmbraClient,
  callbacks?: NonNullable<RegisterOptions>["callbacks"]
) {
  const zkProver = getUserRegistrationProver();
  const register = getUserRegistrationFunction({ client }, { zkProver });
  return await register({ confidential: true, anonymous: true, callbacks });
}

/**
 * Check whether a given wallet address is already registered with Umbra.
 * Uses the correct SDK result discriminant: { state: "exists"; data: EncryptedUserAccount }
 */
export async function checkRegistration(
  client: UmbraClient,
  address: string
): Promise<{ isRegistered: boolean; isAnonymous: boolean }> {
  const queryAccount = getUserAccountQuerierFunction({ client });
  try {
    // SDK requires a branded Address — cast from string
    const result = await queryAccount(address as Address);
    if (result.state === "exists") {
      return {
        isRegistered: true,
        isAnonymous: result.data.isActiveForAnonymousUsage,
      };
    }
    return { isRegistered: false, isAnonymous: false };
  } catch {
    // SDK throws on RPC / decode errors when account does not exist
    return { isRegistered: false, isAnonymous: false };
  }
}

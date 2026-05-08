import { getPublicBalanceToEncryptedBalanceDirectDepositorFunction } from "@umbra-privacy/sdk";
import type { Address } from "@solana/addresses";
import type { getOrCreateUmbraClient } from "@/lib/umbra/client";

type UmbraClient = Awaited<ReturnType<typeof getOrCreateUmbraClient>>;

/**
 * Shield SPL tokens from a public wallet balance into an encrypted Umbra balance.
 *
 * @param client          - Initialised Umbra client
 * @param recipientAddress - Base58 address of the recipient (usually the signer themselves for treasury deposits)
 * @param mint             - SPL token mint address
 * @param amount           - Amount in lamports / raw token units (not UI amount)
 *
 * Returns a DepositResult containing queueSignature + callback info.
 */
export async function depositToEncryptedBalance(
  client: UmbraClient,
  recipientAddress: Address,
  mint: Address,
  amount: bigint
) {
  const deposit = getPublicBalanceToEncryptedBalanceDirectDepositorFunction({
    client,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await deposit(recipientAddress, mint, amount as any);
}

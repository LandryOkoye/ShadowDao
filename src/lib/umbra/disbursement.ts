import {
  getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction,
} from "@umbra-privacy/sdk";
import { getCreateReceiverClaimableUtxoFromEncryptedBalanceProver } from "@umbra-privacy/web-zk-prover";
import type { Address } from "@solana/addresses";
import type { getOrCreateUmbraClient } from "@/lib/umbra/client";

type UmbraClient = Awaited<ReturnType<typeof getOrCreateUmbraClient>>;

/**
 * Anonymously disburse tokens from the DAO encrypted balance to a recipient
 * via the Umbra UTXO mixer.
 *
 * Sends 2 transactions:
 *   1. ZK proof account creation
 *   2. UTXO creation (actual disbursement)
 *
 * @returns Array of transaction signatures [proofAccountSig, utxoCreationSig]
 */
export async function createReceiverClaimableUtxo(
  client: UmbraClient,
  recipient: Address,
  mint: Address,
  amount: bigint
): Promise<string[]> {
  const zkProver = getCreateReceiverClaimableUtxoFromEncryptedBalanceProver();
  const createUtxo = getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction(
    { client },
    { zkProver }
  );

  // SDK: CreateReceiverClaimableUtxoFromEncryptedBalanceFunction
  //   args: { amount: U64, destinationAddress: Address, mint: Address }
  //   returns: Promise<TransactionSignature[]>   [proofAccountSig, utxoCreationSig]
  // U64 is a branded bigint — cast at the boundary
  const sigs = await createUtxo({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    amount: amount as any,
    destinationAddress: recipient,
    mint,
  });

  // TransactionSignature is a branded string — cast back to plain string[]
  return sigs as unknown as string[];
}

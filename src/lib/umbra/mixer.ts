import {
  getClaimableUtxoScannerFunction,
  getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction,
} from "@umbra-privacy/sdk";
import { getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver } from "@umbra-privacy/web-zk-prover";
import type { getOrCreateUmbraClient } from "@/lib/umbra/client";

type UmbraClient = Awaited<ReturnType<typeof getOrCreateUmbraClient>>;
type U32Input = number | bigint;

const U32_MAX = BigInt(0xffffffff);

function toU32Input(value: U32Input, label: string): bigint {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer.`);
  }

  const parsed = BigInt(value);
  if (parsed < BigInt(0) || parsed > U32_MAX) {
    throw new Error(`${label} must be between 0 and ${String(U32_MAX)}.`);
  }

  return parsed;
}

/**
 * Scan the UTXO tree for claimable UTXOs directed to the connected wallet.
 *
 * SDK positional signature: scanner(treeIndex: U32, startInsertionIndex: U32, endInsertionIndex?: U32)
 *
 * @param treeIndex - Which UTXO tree to scan (start with 0)
 * @param start     - Start leaf index (0)
 * @param end       - End leaf index (defaults to current tree size)
 */
export async function scanUtxos(
  client: UmbraClient,
  treeIndex: U32Input = BigInt(0),
  start: U32Input = BigInt(0),
  end?: U32Input
) {
  const scanner = getClaimableUtxoScannerFunction({ client });
  const treeIndexU32 = toU32Input(treeIndex, "Tree index");
  const startU32 = toU32Input(start, "Start insertion index");
  const endU32 =
    end !== undefined ? toU32Input(end, "End insertion index") : undefined;

  // U32 is a branded bigint in the SDK; cast only after runtime validation.
  return await scanner(
    treeIndexU32 as unknown as Parameters<typeof scanner>[0],
    startU32 as unknown as Parameters<typeof scanner>[1],
    endU32 as unknown as Parameters<typeof scanner>[2]
  );
}

/**
 * Claim previously scanned received UTXOs into the wallet's encrypted balance.
 *
 * SDK: result is ClaimUtxoIntoEncryptedBalanceResult.
 * The docs show { signatures: Record<number, TransactionSignature[]> },
 * but TypeScript types may differ, so we cast defensively.
 *
 * @returns Flat array of all transaction signatures
 */
export async function claimReceivedUtxos(
  client: UmbraClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  utxos: any[]
): Promise<string[]> {
  const zkProver = getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver();

  const claimer = getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction(
    { client },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { zkProver } as any
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await claimer(utxos);

  // Flatten result.signatures: Record<number, TransactionSignature[]> -> string[].
  if (result && typeof result === "object" && result.signatures) {
    const allSigs: string[] = [];
    for (const sigs of Object.values(result.signatures) as string[][]) {
      for (const sig of sigs) allSigs.push(sig);
    }
    return allSigs;
  }

  // Fallback: treat result itself as string[] if no signatures property.
  if (Array.isArray(result)) return result as string[];
  return [];
}

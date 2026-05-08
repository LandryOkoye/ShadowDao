import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { Address } from "@solana/addresses";
import { VersionedTransaction } from "@solana/web3.js";
import { getTransactionDecoder, getTransactionEncoder } from "@solana/kit";

// IUmbraSigner is declared in @umbra-privacy/sdk/interfaces but not re-exported
// from the main package. We use a compatible duck-typed shape instead.
//
// The SDK's signMessage expects: Promise<SignedMessage>
// where SignedMessage is { message: Uint8Array; signature: Uint8Array; signer: Address }
// (the field names changed between SDK versions)
//
// We return an opaque object with `as any` so TypeScript doesn't block us.
// Phantom fulfils the signing contract at runtime regardless of exact field names.

type WalletSigner = {
  readonly address: Address;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signTransaction(transaction: any): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signTransactions(transactions: readonly any[]): Promise<any[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signMessage(message: Uint8Array): Promise<any>;
};

type KitTransaction = {
  readonly messageBytes: Uint8Array;
  readonly signatures: Record<string, Uint8Array | null>;
};

function isKitTransaction(tx: unknown): tx is KitTransaction {
  return (
    typeof tx === "object" &&
    tx !== null &&
    "messageBytes" in tx &&
    "signatures" in tx
  );
}

async function signKitTransaction<T extends KitTransaction>(
  transaction: T,
  signVersionedTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
): Promise<T> {
  const wireBytes = getTransactionEncoder().encode(
    transaction as unknown as Parameters<ReturnType<typeof getTransactionEncoder>["encode"]>[0]
  );
  const web3Tx = VersionedTransaction.deserialize(Uint8Array.from(wireBytes));
  const signedWeb3Tx = await signVersionedTransaction(web3Tx);
  const decoded = getTransactionDecoder().decode(signedWeb3Tx.serialize());
  const signatures: Record<string, Uint8Array | null> = {
    ...decoded.signatures,
  };
  for (const [address, signature] of Object.entries(transaction.signatures)) {
    if (signature && !signatures[address]) signatures[address] = signature;
  }

  return {
    ...transaction,
    messageBytes: decoded.messageBytes,
    signatures,
  };
}

/**
 * Adapts a Solana Wallet Adapter `WalletContextState` into the structural
 * signer shape required by `getUmbraClient`.
 *
 * The Umbra SDK uses web3.js v2 transaction types internally, but Phantom
 * signs web3.js v1 transactions. We pass through opaquely — Phantom handles
 * both formats at runtime.
 */
export function createUmbraSigner(wallet: WalletContextState): WalletSigner {
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected — cannot create Umbra signer.");
  }
  if (
    !wallet.signMessage ||
    !wallet.signTransaction ||
    !wallet.signAllTransactions
  ) {
    throw new Error(
      "Connected wallet does not support required signing methods."
    );
  }

  const address = wallet.publicKey.toBase58() as Address;

  // Capture non-null refs so closures are always defined
  const signMsg = wallet.signMessage;
  const signTx = wallet.signTransaction;
  const signAllTxs = wallet.signAllTransactions;

  return {
    address,

    // The SDK's SignedMessage type requires { message, signature, signer }
    // We build the object with both old and new field names for maximum compatibility
    signMessage: async (message: Uint8Array) => {
      const signature = await signMsg(message);
      return {
        // current SDK field names
        message,
        signature,
        signer: address,
        // legacy field names (some SDK versions used these)
        bytes: message,
        address,
      };
    },

    signTransaction: async (tx: unknown): Promise<unknown> => {
      if (isKitTransaction(tx)) {
        return signKitTransaction(tx, signTx);
      }
      return signTx(tx as Parameters<typeof signTx>[0]);
    },

    signTransactions: async (txs: readonly unknown[]): Promise<unknown[]> => {
      if (txs.every(isKitTransaction)) {
        const signed: unknown[] = [];
        for (const tx of txs) {
          signed.push(await signKitTransaction(tx, signTx));
        }
        return signed;
      }
      return signAllTxs(txs as Parameters<typeof signAllTxs>[0]);
    },
  };
}

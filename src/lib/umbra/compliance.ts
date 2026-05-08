import {
  getComplianceGrantIssuerFunction,
  getComplianceGrantRevokerFunction,
  getUserComplianceGrantQuerierFunction,
} from "@umbra-privacy/sdk";
import type { Address } from "@solana/addresses";
import type { getOrCreateUmbraClient } from "@/lib/umbra/client";

type UmbraClient = Awaited<ReturnType<typeof getOrCreateUmbraClient>>;

/**
 * Decode a base64 string into a Uint8Array and cast to the SDK's
 * branded X25519PublicKey type. The UI stores X25519 keys as base64 strings;
 * the SDK requires a typed Uint8Array.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeX25519Key(b64: string): any {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Grant a compliance viewer (auditor) access to transaction history. */
export async function grantViewingAccess(
  client: UmbraClient,
  receiver: Address,
  granterX25519: string,
  receiverX25519: string,
  nonce: string
) {
  const createGrant = getComplianceGrantIssuerFunction({ client });
  return await createGrant(
    receiver,
    decodeX25519Key(granterX25519),
    decodeX25519Key(receiverX25519),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    BigInt(nonce) as any
  );
}

/** Revoke a previously issued compliance grant. */
export async function revokeViewingAccess(
  client: UmbraClient,
  receiver: Address,
  granterX25519: string,
  receiverX25519: string,
  nonce: string
) {
  const revokeGrant = getComplianceGrantRevokerFunction({ client });
  return await revokeGrant(
    receiver,
    decodeX25519Key(granterX25519),
    decodeX25519Key(receiverX25519),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    BigInt(nonce) as any
  );
}

/**
 * Query whether a compliance grant currently exists on-chain.
 * Returns `{ state: "exists" }` or `{ state: "non_existent" }`.
 */
export async function checkGrantStatus(
  client: UmbraClient,
  granterX25519: string,
  nonce: string,
  receiverX25519: string
) {
  const queryGrant = getUserComplianceGrantQuerierFunction({ client });
  return await queryGrant(
    decodeX25519Key(granterX25519),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    BigInt(nonce) as any,
    decodeX25519Key(receiverX25519)
  );
}

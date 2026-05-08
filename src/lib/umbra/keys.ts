import { getUserAccountX25519KeypairDeriver } from "@umbra-privacy/sdk";
import type { getOrCreateUmbraClient } from "@/lib/umbra/client";

type UmbraClient = Awaited<ReturnType<typeof getOrCreateUmbraClient>>;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function deriveUserX25519PublicKey(client: UmbraClient): Promise<string> {
  const derive = getUserAccountX25519KeypairDeriver({ client });
  const keypair = await derive();
  return toBase64(keypair.x25519Keypair.publicKey);
}

import { PublicKey } from "@solana/web3.js";

export function isValidSolanaAddress(value: string): boolean {
  try {
    const key = new PublicKey(value);
    return PublicKey.isOnCurve(key.toBytes());
  } catch {
    return false;
  }
}

export function parseTokenAmount(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Enter a positive numeric amount.");
  }

  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) {
    throw new Error(`Amount supports at most ${decimals} decimal places.`);
  }

  const raw = BigInt(whole) * BigInt(10) ** BigInt(decimals);
  const fractional = BigInt((fraction + "0".repeat(decimals)).slice(0, decimals));
  const amount = raw + fractional;

  if (amount <= BigInt(0)) {
    throw new Error("Amount must be greater than zero.");
  }

  return amount;
}

export function isValidBase64Bytes(value: string, expectedLength?: number): boolean {
  try {
    const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
    return expectedLength === undefined || bytes.length === expectedLength;
  } catch {
    return false;
  }
}

export function generateNonce(): string {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  return `${Date.now()}${bytes[0]}${bytes[1]}`;
}

export type StreamStatus = "active" | "cancelled" | "completed";

export interface Stream {
  id: string;
  proposalId: string;
  recipient: string;
  mint: string;
  totalAmountRaw: bigint;
  claimedAmountRaw: bigint;
  startAt: number;
  cliffAt: number;
  endAt: number;
  cancelledAt?: number;
  cancelledBy?: string;
  status: StreamStatus;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
}

export interface StreamRuntime {
  unlockedAmountRaw: bigint;
  claimableAmountRaw: bigint;
  remainingAmountRaw: bigint;
}

export function getUnlockedAmount(stream: Stream, nowMs: number): bigint {
  const effectiveEnd = stream.cancelledAt ? Math.min(stream.cancelledAt, stream.endAt) : stream.endAt;
  const total = stream.totalAmountRaw;

  if (nowMs < stream.cliffAt) return 0n;
  if (effectiveEnd <= stream.startAt) return total;
  if (nowMs >= effectiveEnd) return total;
  if (nowMs <= stream.startAt) return 0n;

  const elapsed = BigInt(nowMs - stream.startAt);
  const duration = BigInt(effectiveEnd - stream.startAt);
  return (total * elapsed) / duration;
}

export function getStreamRuntime(stream: Stream, nowMs: number): StreamRuntime {
  const unlocked = getUnlockedAmount(stream, nowMs);
  const claimed = stream.claimedAmountRaw < 0n ? 0n : stream.claimedAmountRaw;
  const boundedClaimed = claimed > unlocked ? unlocked : claimed;
  const claimable = unlocked - boundedClaimed;
  const remaining = stream.totalAmountRaw > claimed ? stream.totalAmountRaw - claimed : 0n;
  return {
    unlockedAmountRaw: unlocked,
    claimableAmountRaw: claimable,
    remainingAmountRaw: remaining,
  };
}


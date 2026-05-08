import type { Stream } from "@/lib/streams/model";

export type SerializedStream = Omit<Stream, "totalAmountRaw" | "claimedAmountRaw"> & {
  totalAmountRaw: string;
  claimedAmountRaw: string;
};

export type StreamWithRuntime = Stream & {
  runtime: {
    unlockedAmountRaw: bigint;
    claimableAmountRaw: bigint;
    remainingAmountRaw: bigint;
  };
};

type SerializedStreamWithRuntime = SerializedStream & {
  runtime: {
    unlockedAmountRaw: string;
    claimableAmountRaw: string;
    remainingAmountRaw: string;
  };
};

function hydrateStream(stream: SerializedStream): Stream {
  return {
    ...stream,
    totalAmountRaw: BigInt(stream.totalAmountRaw),
    claimedAmountRaw: BigInt(stream.claimedAmountRaw),
  };
}

function hydrateRuntime(stream: SerializedStreamWithRuntime): StreamWithRuntime {
  const base = hydrateStream(stream);
  return {
    ...base,
    runtime: {
      unlockedAmountRaw: BigInt(stream.runtime.unlockedAmountRaw),
      claimableAmountRaw: BigInt(stream.runtime.claimableAmountRaw),
      remainingAmountRaw: BigInt(stream.runtime.remainingAmountRaw),
    },
  };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? "Stream request failed.");
  }
  return payload as T;
}

export async function getStreams(filters?: { recipient?: string; proposalId?: string }): Promise<StreamWithRuntime[]> {
  const params = new URLSearchParams();
  if (filters?.recipient) params.set("recipient", filters.recipient);
  if (filters?.proposalId) params.set("proposalId", filters.proposalId);
  const query = params.toString();
  const payload = await request<{ streams: SerializedStreamWithRuntime[] }>(`/api/streams${query ? `?${query}` : ""}`);
  return payload.streams.map(hydrateRuntime);
}

export async function createStream(input: {
  proposalId: string;
  createdBy: string;
  startAt: number;
  cliffAt: number;
  endAt: number;
}): Promise<Stream> {
  const payload = await request<{ stream: SerializedStream }>("/api/streams", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return hydrateStream(payload.stream);
}

export async function cancelStream(streamId: string, cancelledBy: string): Promise<Stream> {
  const payload = await request<{ stream: SerializedStream }>(`/api/streams/${streamId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancelledBy }),
  });
  return hydrateStream(payload.stream);
}

export async function checkpointStreamClaim(input: {
  streamId: string;
  requestId: string;
  claimer: string;
  amountRaw: bigint;
  txSignature: string;
}): Promise<Stream> {
  const payload = await request<{ stream: SerializedStream }>(`/api/streams/${input.streamId}/claim`, {
    method: "POST",
    body: JSON.stringify({
      requestId: input.requestId,
      claimer: input.claimer,
      amountRaw: input.amountRaw.toString(),
      txSignature: input.txSignature,
    }),
  });
  return hydrateStream(payload.stream);
}

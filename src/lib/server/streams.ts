import type { PoolClient } from "pg";
import { ensureSchema, getPool } from "@/lib/server/db";
import type { Proposal } from "@/lib/store/proposals";
import { findProposal } from "@/lib/server/proposals";
import { isValidSolanaAddress } from "@/lib/utils/validation";
import { getStreamRuntime, type Stream, type StreamStatus } from "@/lib/streams/model";
import { assertRecipientAllowedInPanic, getPanicPolicy } from "@/lib/server/panic";

type StreamRow = {
  id: string;
  proposal_id: string;
  recipient: string;
  mint: string;
  total_amount_raw: string;
  claimed_amount_raw: string;
  start_at: string | number;
  cliff_at: string | number;
  end_at: string | number;
  cancelled_at: string | number | null;
  cancelled_by: string | null;
  status: StreamStatus;
  created_at: string | number;
  created_by: string;
  updated_at: string | number;
};

export type SerializedStream = Omit<
  Stream,
  "totalAmountRaw" | "claimedAmountRaw"
> & {
  totalAmountRaw: string;
  claimedAmountRaw: string;
};

export type CreateStreamInput = {
  proposalId: string;
  createdBy: string;
  startAt: number;
  cliffAt: number;
  endAt: number;
};

export type StreamWithRuntime = Stream & {
  runtime: {
    unlockedAmountRaw: bigint;
    claimableAmountRaw: bigint;
    remainingAmountRaw: bigint;
  };
};

function toStream(row: StreamRow): Stream {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    recipient: row.recipient,
    mint: row.mint,
    totalAmountRaw: BigInt(row.total_amount_raw),
    claimedAmountRaw: BigInt(row.claimed_amount_raw),
    startAt: Number(row.start_at),
    cliffAt: Number(row.cliff_at),
    endAt: Number(row.end_at),
    cancelledAt: row.cancelled_at === null ? undefined : Number(row.cancelled_at),
    cancelledBy: row.cancelled_by ?? undefined,
    status: row.status,
    createdAt: Number(row.created_at),
    createdBy: row.created_by,
    updatedAt: Number(row.updated_at),
  };
}

export function serializeStream(stream: Stream): SerializedStream {
  return {
    ...stream,
    totalAmountRaw: stream.totalAmountRaw.toString(),
    claimedAmountRaw: stream.claimedAmountRaw.toString(),
  };
}

function validateTimeline(input: CreateStreamInput) {
  if (!Number.isFinite(input.startAt) || !Number.isFinite(input.cliffAt) || !Number.isFinite(input.endAt)) {
    throw new Error("Invalid stream timeline.");
  }
  if (input.startAt <= 0 || input.cliffAt <= 0 || input.endAt <= 0) {
    throw new Error("Stream dates must be positive timestamps.");
  }
  if (input.cliffAt < input.startAt) throw new Error("Cliff must be at or after start.");
  if (input.endAt <= input.startAt) throw new Error("End must be after start.");
}

async function getProposalForStream(proposalId: string): Promise<Proposal> {
  const proposal = await findProposal(proposalId);
  if (!proposal) throw new Error("Proposal not found.");
  if (proposal.status !== "approved" && proposal.status !== "disbursed") {
    throw new Error("Only approved/disbursed proposals can create streams.");
  }
  return proposal;
}

export async function listStreams(): Promise<StreamWithRuntime[]> {
  await ensureSchema();
  const result = await getPool().query<StreamRow>(
    "SELECT * FROM shadowdao_streams ORDER BY created_at DESC"
  );
  const now = Date.now();
  return result.rows.map((row) => {
    const stream = toStream(row);
    return { ...stream, runtime: getStreamRuntime(stream, now) };
  });
}

export async function listStreamsForRecipient(recipient: string): Promise<StreamWithRuntime[]> {
  if (!isValidSolanaAddress(recipient)) throw new Error("Recipient address is invalid.");
  await ensureSchema();
  const result = await getPool().query<StreamRow>(
    "SELECT * FROM shadowdao_streams WHERE recipient = $1 ORDER BY created_at DESC",
    [recipient]
  );
  const now = Date.now();
  return result.rows.map((row) => {
    const stream = toStream(row);
    return { ...stream, runtime: getStreamRuntime(stream, now) };
  });
}

export async function listStreamsForProposal(proposalId: string): Promise<StreamWithRuntime[]> {
  await ensureSchema();
  const result = await getPool().query<StreamRow>(
    "SELECT * FROM shadowdao_streams WHERE proposal_id = $1 ORDER BY created_at DESC",
    [proposalId]
  );
  const now = Date.now();
  return result.rows.map((row) => {
    const stream = toStream(row);
    return { ...stream, runtime: getStreamRuntime(stream, now) };
  });
}

export async function findStream(streamId: string): Promise<Stream | null> {
  await ensureSchema();
  const result = await getPool().query<StreamRow>(
    "SELECT * FROM shadowdao_streams WHERE id = $1",
    [streamId]
  );
  return result.rows[0] ? toStream(result.rows[0]) : null;
}

export async function createStream(input: CreateStreamInput): Promise<Stream> {
  if (!isValidSolanaAddress(input.createdBy)) throw new Error("Creator address is invalid.");
  validateTimeline(input);
  await ensureSchema();

  const proposal = await getProposalForStream(input.proposalId);
  const panic = await getPanicPolicy();
  assertRecipientAllowedInPanic(panic, proposal.recipient);
  if (proposal.recipient.trim().length === 0) throw new Error("Proposal recipient is missing.");

  const existing = await getPool().query<{ id: string }>(
    "SELECT id FROM shadowdao_streams WHERE proposal_id = $1 LIMIT 1",
    [input.proposalId]
  );
  if (existing.rows[0]) throw new Error("A stream already exists for this proposal.");

  const cappedEndAt =
    panic.isArmed
      ? Math.min(input.endAt, input.startAt + panic.maxStreamDurationMs)
      : input.endAt;
  if (cappedEndAt <= input.startAt) {
    throw new Error("Panic mode stream duration cap makes the end time invalid.");
  }
  const cappedCliffAt = Math.min(input.cliffAt, cappedEndAt);

  const now = Date.now();
  const result = await getPool().query<StreamRow>(
    `INSERT INTO shadowdao_streams (
      id, proposal_id, recipient, mint, total_amount_raw, claimed_amount_raw,
      start_at, cliff_at, end_at, status, created_at, created_by, updated_at
    ) VALUES ($1, $2, $3, $4, $5, '0', $6, $7, $8, 'active', $9, $10, $9)
    RETURNING *`,
    [
      crypto.randomUUID(),
      proposal.id,
      proposal.recipient,
      proposal.mint,
      proposal.amountRaw.toString(),
      input.startAt,
      cappedCliffAt,
      cappedEndAt,
      now,
      input.createdBy,
    ]
  );
  return toStream(result.rows[0]);
}

export async function cancelStream(streamId: string, cancelledBy: string): Promise<Stream> {
  if (!isValidSolanaAddress(cancelledBy)) throw new Error("Canceller address is invalid.");
  await ensureSchema();
  const current = await findStream(streamId);
  if (!current) throw new Error("Stream not found.");
  if (current.status !== "active") throw new Error("Only active streams can be cancelled.");

  const now = Date.now();
  const result = await getPool().query<StreamRow>(
    `UPDATE shadowdao_streams
     SET status = 'cancelled', cancelled_at = $2, cancelled_by = $3, updated_at = $2
     WHERE id = $1
     RETURNING *`,
    [streamId, now, cancelledBy]
  );
  return toStream(result.rows[0]);
}

async function ensureClaimCanProceed(
  client: PoolClient,
  streamId: string,
  claimer: string,
  amountRaw: bigint
): Promise<Stream> {
  const streamResult = await client.query<StreamRow>(
    "SELECT * FROM shadowdao_streams WHERE id = $1 FOR UPDATE",
    [streamId]
  );
  const row = streamResult.rows[0];
  if (!row) throw new Error("Stream not found.");

  const stream = toStream(row);
  if (stream.recipient !== claimer) throw new Error("Only the stream recipient can claim.");
  if (stream.status === "completed") throw new Error("Stream already completed.");

  const runtime = getStreamRuntime(stream, Date.now());
  if (runtime.claimableAmountRaw <= 0n) throw new Error("No claimable amount unlocked yet.");
  if (amountRaw <= 0n) throw new Error("Claim amount must be greater than zero.");
  if (amountRaw > runtime.claimableAmountRaw) throw new Error("Claim amount exceeds unlocked amount.");
  return stream;
}

export async function checkpointStreamClaim(input: {
  streamId: string;
  requestId: string;
  claimer: string;
  amountRaw: string;
  txSignature: string;
}): Promise<Stream> {
  if (!isValidSolanaAddress(input.claimer)) throw new Error("Claimer address is invalid.");
  if (!input.requestId.trim()) throw new Error("requestId is required.");
  if (!input.txSignature.trim()) throw new Error("txSignature is required.");

  const amountRaw = BigInt(input.amountRaw);
  await ensureSchema();
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    const alreadyClaimed = await client.query<{ stream_id: string }>(
      "SELECT stream_id FROM shadowdao_stream_claims WHERE request_id = $1 LIMIT 1",
      [input.requestId]
    );
    if (alreadyClaimed.rows[0]) {
      if (alreadyClaimed.rows[0].stream_id !== input.streamId) {
        throw new Error("requestId already used for a different stream.");
      }
      const existing = await client.query<StreamRow>(
        "SELECT * FROM shadowdao_streams WHERE id = $1",
        [input.streamId]
      );
      await client.query("COMMIT");
      return toStream(existing.rows[0]);
    }

    const stream = await ensureClaimCanProceed(client, input.streamId, input.claimer, amountRaw);
    const nextClaimed = stream.claimedAmountRaw + amountRaw;
    const nextStatus: StreamStatus = nextClaimed >= stream.totalAmountRaw ? "completed" : stream.status;
    const now = Date.now();

    await client.query(
      `INSERT INTO shadowdao_stream_claims (id, stream_id, request_id, claimer, amount_raw, tx_signature, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [crypto.randomUUID(), input.streamId, input.requestId, input.claimer, amountRaw.toString(), input.txSignature, now]
    );

    const updated = await client.query<StreamRow>(
      `UPDATE shadowdao_streams
       SET claimed_amount_raw = $2, status = $3, updated_at = $4
       WHERE id = $1
       RETURNING *`,
      [input.streamId, nextClaimed.toString(), nextStatus, now]
    );

    await client.query("COMMIT");
    return toStream(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

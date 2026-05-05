import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/server/db";
import {
  createStream,
  listStreamsForProposal,
  listStreams,
  listStreamsForRecipient,
  serializeStream,
  type StreamWithRuntime,
} from "@/lib/server/streams";

export const dynamic = "force-dynamic";

function serializeStreamWithRuntime(stream: StreamWithRuntime) {
  return {
    ...serializeStream(stream),
    runtime: {
      unlockedAmountRaw: stream.runtime.unlockedAmountRaw.toString(),
      claimableAmountRaw: stream.runtime.claimableAmountRaw.toString(),
      remainingAmountRaw: stream.runtime.remainingAmountRaw.toString(),
    },
  };
}

function databaseError() {
  return NextResponse.json(
    { error: "Postgres is not configured. Add DATABASE_URL or POSTGRES_URL to the environment." },
    { status: 503 }
  );
}

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) return databaseError();
  try {
    const { searchParams } = new URL(request.url);
    const recipient = searchParams.get("recipient")?.trim();
    const proposalId = searchParams.get("proposalId")?.trim();
    const streams = proposalId
      ? await listStreamsForProposal(proposalId)
      : recipient
        ? await listStreamsForRecipient(recipient)
        : await listStreams();
    return NextResponse.json({ streams: streams.map(serializeStreamWithRuntime) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) return databaseError();
  try {
    const body = await request.json();
    const stream = await createStream(body);
    return NextResponse.json({ stream: serializeStream(stream) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

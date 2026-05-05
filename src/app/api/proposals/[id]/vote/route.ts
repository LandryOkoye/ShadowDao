import { NextResponse } from "next/server";
import { addVote, serializeProposal } from "@/lib/server/proposals";
import { isDatabaseConfigured } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Postgres is not configured." }, { status: 503 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const proposal = await addVote(id, body.voter, body.choice);
    return NextResponse.json({ proposal: serializeProposal(proposal) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}

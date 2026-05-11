import { NextResponse } from "next/server";
import { serializeProposal, updateProposalStatus } from "@/lib/server/proposals";
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
    const { signature, actor } = await request.json();
    if (!signature) throw new Error("Disbursement signature is required.");
    const proposal = await updateProposalStatus(id, "disbursed", signature, typeof actor === "string" ? actor : undefined);
    return NextResponse.json({ proposal: serializeProposal(proposal) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}

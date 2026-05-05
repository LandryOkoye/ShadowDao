import { NextResponse } from "next/server";
import { findProposal, serializeProposal } from "@/lib/server/proposals";
import { isDatabaseConfigured } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Postgres is not configured." }, { status: 503 });
  }

  try {
    const { id } = await params;
    const proposal = await findProposal(id);
    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }
    return NextResponse.json({ proposal: serializeProposal(proposal) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

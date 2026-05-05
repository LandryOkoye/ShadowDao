import { NextResponse } from "next/server";
import { insertProposal, listProposals, serializeProposal } from "@/lib/server/proposals";
import { isDatabaseConfigured } from "@/lib/server/db";

export const dynamic = "force-dynamic";

function databaseError() {
  return NextResponse.json(
    { error: "Postgres is not configured. Add DATABASE_URL or POSTGRES_URL to the environment." },
    { status: 503 }
  );
}

export async function GET() {
  if (!isDatabaseConfigured()) return databaseError();
  try {
    const proposals = await listProposals();
    return NextResponse.json({ proposals: proposals.map(serializeProposal) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) return databaseError();
  try {
    const proposal = await insertProposal(await request.json());
    return NextResponse.json({ proposal: serializeProposal(proposal) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

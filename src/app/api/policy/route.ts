import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/server/db";
import {
  getPolicyEngine,
  listPolicyAudits,
  listRecipientProfiles,
  updatePolicyEngine,
  upsertRecipientProfile,
} from "@/lib/server/policy";

export const dynamic = "force-dynamic";

function dbError() {
  return NextResponse.json({ error: "Postgres is not configured." }, { status: 503 });
}

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) return dbError();
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "60");
    const [policy, recipients, audits] = await Promise.all([
      getPolicyEngine(),
      listRecipientProfiles(),
      listPolicyAudits(limit),
    ]);
    return NextResponse.json({ policy, recipients, audits });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) return dbError();
  try {
    const body = await request.json();
    const action = String(body.action ?? "");
    if (!action) throw new Error("Action is required.");

    if (action === "update_policy") {
      const policy = await updatePolicyEngine({
        actor: body.actor,
        isEnabled: body.isEnabled,
        blockedJurisdictions: body.blockedJurisdictions,
        allowedJurisdictions: body.allowedJurisdictions,
        maxAmountByRisk: body.maxAmountByRisk,
        requireAdminForHighRisk: body.requireAdminForHighRisk,
      });
      return NextResponse.json({ policy });
    }

    if (action === "upsert_recipient_profile") {
      const profile = await upsertRecipientProfile({
        actor: body.actor,
        recipient: body.recipient,
        jurisdiction: body.jurisdiction,
        riskLevel: body.riskLevel,
        category: body.category,
      });
      return NextResponse.json({ profile });
    }

    throw new Error("Unknown policy action.");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}


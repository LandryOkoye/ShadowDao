import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/server/db";
import { ADMIN_ADDRESSES } from "@/lib/utils/constants";
import {
  addSafetyRecipient,
  approveDisarm,
  armPanicMode,
  disarmPanicMode,
  getPanicPolicy,
  listPanicAuditLogs,
  removeSafetyRecipient,
} from "@/lib/server/panic";

export const dynamic = "force-dynamic";

function dbError() {
  return NextResponse.json({ error: "Postgres is not configured." }, { status: 503 });
}

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) return dbError();
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "50");
    const [policy, logs] = await Promise.all([getPanicPolicy(), listPanicAuditLogs(limit)]);
    return NextResponse.json({ policy, logs });
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
    const actor = String(body.actor ?? "");
    if (!action) throw new Error("Action is required.");
    if (!actor) throw new Error("Actor address is required.");

    const adminOnlyAction =
      action === "arm" ||
      action === "disarm" ||
      action === "add_safety_recipient" ||
      action === "remove_safety_recipient";
    if (adminOnlyAction) {
      if (ADMIN_ADDRESSES.length === 0) {
        throw new Error("Admin controls are disabled: configure NEXT_PUBLIC_ADMIN_ADDRESSES.");
      }
      if (!ADMIN_ADDRESSES.includes(actor)) {
        throw new Error("Only admin wallets can perform this panic action.");
      }
    }

    let policy;
    switch (action) {
      case "arm":
        policy = await armPanicMode({
          actor,
          reason: body.reason,
          disbursementsFrozen: body.disbursementsFrozen,
          requiredDisarmApprovals: body.requiredDisarmApprovals,
          maxStreamDurationMs: body.maxStreamDurationMs,
        });
        break;
      case "approve_disarm":
        policy = await approveDisarm(actor);
        break;
      case "disarm":
        policy = await disarmPanicMode(actor);
        break;
      case "add_safety_recipient":
        policy = await addSafetyRecipient(actor, body.recipient);
        break;
      case "remove_safety_recipient":
        policy = await removeSafetyRecipient(actor, body.recipient);
        break;
      default:
        throw new Error("Unknown panic action.");
    }

    return NextResponse.json({ policy });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}

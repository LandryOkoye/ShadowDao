import { ensureSchema, getPool } from "@/lib/server/db";
import { isValidSolanaAddress } from "@/lib/utils/validation";
import type { Proposal, ProposalStatus, Vote } from "@/lib/store/proposals";
import { assertRecipientAllowedInPanic, getPanicPolicy } from "@/lib/server/panic";
import { enforcePolicyOrThrow } from "@/lib/server/policy";

type ProposalRow = {
  id: string;
  title: string;
  description: string;
  recipient: string;
  requested_amount: string;
  amount_raw: string;
  mint: string;
  status: ProposalStatus;
  votes: Vote[] | string;
  created_at: string | number;
  created_by: string;
  disbursement_sig: string | null;
  zk_solvency_proof: string | null;
};

export type CreateProposalInput = {
  title: string;
  description: string;
  recipient: string;
  amountRaw: string;
  mint: string;
  createdBy: string;
  zkSolvencyProof?: string;
};

export type SerializedProposal = Omit<Proposal, "amountRaw"> & { amountRaw: string };

function parseVotes(value: Vote[] | string): Vote[] {
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value) as Vote[];
  } catch {
    return [];
  }
}

function toProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    recipient: row.recipient,
    requestedAmount: row.requested_amount,
    amountRaw: BigInt(row.amount_raw),
    mint: row.mint,
    status: row.status,
    votes: parseVotes(row.votes),
    createdAt: Number(row.created_at),
    createdBy: row.created_by,
    disbursementSig: row.disbursement_sig ?? undefined,
    zkSolvencyProof: row.zk_solvency_proof ?? undefined,
  };
}

export function serializeProposal(proposal: Proposal): SerializedProposal {
  return {
    ...proposal,
    amountRaw: proposal.amountRaw.toString(),
  };
}

function validateCreateInput(input: CreateProposalInput) {
  if (!input.title.trim()) throw new Error("Proposal title is required.");
  if (!input.description.trim()) throw new Error("Proposal description is required.");
  if (!isValidSolanaAddress(input.recipient)) throw new Error("Recipient address is invalid.");
  if (!isValidSolanaAddress(input.createdBy)) throw new Error("Creator address is invalid.");
  if (!isValidSolanaAddress(input.mint)) throw new Error("Token mint address is invalid.");

  const amount = BigInt(input.amountRaw);
  if (amount <= BigInt(0)) throw new Error("Requested amount must be greater than zero.");
}

export async function listProposals(): Promise<Proposal[]> {
  await ensureSchema();
  const result = await getPool().query<ProposalRow>(
    "SELECT * FROM shadowdao_proposals ORDER BY created_at DESC"
  );
  return result.rows.map(toProposal);
}

export async function findProposal(id: string): Promise<Proposal | null> {
  await ensureSchema();
  const result = await getPool().query<ProposalRow>(
    "SELECT * FROM shadowdao_proposals WHERE id = $1",
    [id]
  );
  return result.rows[0] ? toProposal(result.rows[0]) : null;
}

export async function insertProposal(input: CreateProposalInput): Promise<Proposal> {
  validateCreateInput(input);
  await ensureSchema();
  const panic = await getPanicPolicy();
  assertRecipientAllowedInPanic(panic, input.recipient);
  await enforcePolicyOrThrow({
    action: "proposal_create",
    recipient: input.recipient,
    amountRaw: BigInt(input.amountRaw),
    actor: input.createdBy,
  });

  const now = Date.now();
  const result = await getPool().query<ProposalRow>(
    `INSERT INTO shadowdao_proposals (
      id, title, description, recipient, requested_amount, amount_raw, mint,
      status, votes, created_at, created_by, zk_solvency_proof, updated_at
    )
    VALUES ($1, $2, $3, $4, 'Confidential', $5, $6, 'active', '[]'::jsonb, $7, $8, $9, $7)
    RETURNING *`,
    [
      crypto.randomUUID(),
      input.title.trim(),
      input.description.trim(),
      input.recipient,
      input.amountRaw,
      input.mint,
      now,
      input.createdBy,
      input.zkSolvencyProof ?? null,
    ]
  );

  return toProposal(result.rows[0]);
}

export async function addVote(
  proposalId: string,
  voter: string,
  choice: "yes" | "no"
): Promise<Proposal> {
  if (!isValidSolanaAddress(voter)) throw new Error("Voter address is invalid.");

  await ensureSchema();
  const current = await findProposal(proposalId);
  if (!current) throw new Error("Proposal not found.");
  if (current.status !== "active") throw new Error("Voting is closed for this proposal.");

  const votes = current.votes.filter((vote) => vote.voter !== voter);
  votes.push({ voter, choice, timestamp: Date.now() });

  const result = await getPool().query<ProposalRow>(
    `UPDATE shadowdao_proposals
     SET votes = $2::jsonb, updated_at = $3
     WHERE id = $1
     RETURNING *`,
    [proposalId, JSON.stringify(votes), Date.now()]
  );

  return toProposal(result.rows[0]);
}

export async function updateProposalStatus(
  proposalId: string,
  status: Extract<ProposalStatus, "approved" | "disbursed">,
  disbursementSig?: string,
  actor?: string
): Promise<Proposal> {
  await ensureSchema();
  const existing = await findProposal(proposalId);
  if (!existing) throw new Error("Proposal not found.");
  await enforcePolicyOrThrow({
    action: status === "approved" ? "proposal_approve" : "proposal_disburse",
    recipient: existing.recipient,
    amountRaw: existing.amountRaw,
    actor,
  });
  if (status === "disbursed") {
    const panic = await getPanicPolicy();
    if (panic.isArmed && panic.disbursementsFrozen) {
      assertRecipientAllowedInPanic(panic, existing.recipient);
    }
  }
  const result = await getPool().query<ProposalRow>(
    `UPDATE shadowdao_proposals
     SET status = $2, disbursement_sig = COALESCE($3, disbursement_sig), updated_at = $4
     WHERE id = $1
     RETURNING *`,
    [proposalId, status, disbursementSig ?? null, Date.now()]
  );

  if (!result.rows[0]) throw new Error("Proposal not found.");
  return toProposal(result.rows[0]);
}

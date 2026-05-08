export type ProposalStatus = "draft" | "active" | "approved" | "disbursed" | "rejected";

export interface Vote {
  voter: string;
  choice: "yes" | "no";
  timestamp: number;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  recipient: string;
  requestedAmount: string;
  amountRaw: bigint;
  mint: string;
  status: ProposalStatus;
  votes: Vote[];
  createdAt: number;
  createdBy: string;
  disbursementSig?: string;
  zkSolvencyProof?: string;
}

type SerializedProposal = Omit<Proposal, "amountRaw"> & { amountRaw: string };

type CreateProposalInput = {
  title: string;
  description: string;
  recipient: string;
  amountRaw: bigint;
  mint: string;
  createdBy: string;
  zkSolvencyProof?: string;
};

function hydrate(proposal: SerializedProposal): Proposal {
  return {
    ...proposal,
    amountRaw: BigInt(proposal.amountRaw),
  };
}

async function requestProposal<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? "Proposal request failed.");
  }
  return payload as T;
}

export async function getProposals(): Promise<Proposal[]> {
  const payload = await requestProposal<{ proposals: SerializedProposal[] }>("/api/proposals");
  return payload.proposals.map(hydrate);
}

export async function getProposal(id: string): Promise<Proposal | undefined> {
  const payload = await requestProposal<{ proposal: SerializedProposal }>(`/api/proposals/${id}`);
  return hydrate(payload.proposal);
}

export async function createProposal(data: CreateProposalInput): Promise<Proposal> {
  const payload = await requestProposal<{ proposal: SerializedProposal }>("/api/proposals", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      amountRaw: data.amountRaw.toString(),
    }),
  });
  return hydrate(payload.proposal);
}

export async function castVote(
  proposalId: string,
  voter: string,
  choice: "yes" | "no"
): Promise<Proposal> {
  const payload = await requestProposal<{ proposal: SerializedProposal }>(
    `/api/proposals/${proposalId}/vote`,
    {
      method: "POST",
      body: JSON.stringify({ voter, choice }),
    }
  );
  return hydrate(payload.proposal);
}

export async function approveProposal(proposalId: string): Promise<Proposal> {
  const payload = await requestProposal<{ proposal: SerializedProposal }>(
    `/api/proposals/${proposalId}/approve`,
    { method: "POST" }
  );
  return hydrate(payload.proposal);
}

export async function markDisbursed(proposalId: string, sig: string): Promise<Proposal> {
  const payload = await requestProposal<{ proposal: SerializedProposal }>(
    `/api/proposals/${proposalId}/disburse`,
    {
      method: "POST",
      body: JSON.stringify({ signature: sig }),
    }
  );
  return hydrate(payload.proposal);
}

export function tallyVotes(proposal: Proposal) {
  const yes = proposal.votes.filter((v) => v.choice === "yes").length;
  const no = proposal.votes.filter((v) => v.choice === "no").length;
  const total = proposal.votes.length;
  const yesPercent = total > 0 ? yes / total : 0;
  return { yes, no, total, yesPercent };
}

export function hasReachedQuorum(
  proposal: Proposal,
  minVotes: number,
  threshold: number
): boolean {
  const { yes, total } = tallyVotes(proposal);
  return total >= minVotes && total > 0 && yes / total >= threshold;
}

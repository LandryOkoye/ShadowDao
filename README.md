# ShadowDAO

ShadowDAO is a private-first DAO treasury MVP on Solana Devnet. It uses the Umbra Privacy SDK for registration, shielded token deposits, encrypted balance reads, anonymous UTXO disbursements, UTXO claiming, compliance viewing grants, and private payout streams.

Governance proposals/votes, stream state, and panic-policy controls are stored in Postgres through Next.js API routes. The actual privacy operations remain client-side wallet-signed Umbra transactions.

## Features

- Umbra registration for confidential + anonymous usage.
- Shield funds from public SPL balances into Umbra encrypted balances.
- Anonymous UTXO disbursement and recipient UTXO scanning/claiming.
- Governance proposals and voting with shared Postgres-backed state.
- Private stream payouts:
  - Create a stream from approved/disbursed proposals.
  - Time-based unlock math with bigint precision.
  - Recipient claim flow via private Umbra disbursement + server claim checkpointing.
- Panic Treasury Mode:
  - Arm/disarm emergency mode.
  - Multi-party disarm approvals (`requiredDisarmApprovals`).
  - Safety recipient allowlist.
  - Disbursement restrictions while panic is armed.
  - Stream duration caps while panic is armed (including active stream shortening).
  - Panic audit trail.

## Environment

Required for Umbra:

```bash
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_RPC_URL=...
NEXT_PUBLIC_RPC_SUBSCRIPTIONS_URL=...
NEXT_PUBLIC_INDEXER_API_ENDPOINT=https://utxo-indexer.api.umbraprivacy.com
NEXT_PUBLIC_USDC_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
NEXT_PUBLIC_USDT_MINT=EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS
```

Required for shared proposal storage:

```bash
DATABASE_URL=postgres://...
# or POSTGRES_URL=postgres://...
# optional: POSTGRES_SSL=false for local databases without SSL
```

Required for admin-gated controls (panic mode arm/disarm + allowlist management):

```bash
NEXT_PUBLIC_ADMIN_ADDRESSES=<wallet1>,<wallet2>
```

## Development

```bash
npm run dev
npm run lint
npm run build
```

The app auto-creates these tables on first API use:

- `shadowdao_proposals`
- `shadowdao_streams`
- `shadowdao_stream_claims`
- `shadowdao_panic_policy`
- `shadowdao_panic_audit_logs`

## MVP Notes

- Proposal/vote storage is now shared via Postgres, not browser `localStorage`.
- Proposal solvency is an MVP check: the client queries the Umbra encrypted balance and only creates a proposal when the USDC balance is readable in `shared` mode and greater than the requested amount.
- Umbra signing bridges SDK `@solana/kit` transactions to wallet-adapter `VersionedTransaction` signing so real wallets can sign registration and protocol transactions.
- Compliance grant history is still local UI history; the grant/revoke/check transactions are real Umbra calls.
- Stream claim checkpointing is idempotent via unique `request_id` entries in `shadowdao_stream_claims`.
- Panic controls are enforced server-side for proposal/stream state transitions and also preflighted in disbursement UIs to avoid wasted wallet signing prompts.

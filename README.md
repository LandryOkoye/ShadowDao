# ShadowDAO

ShadowDAO is a private-first DAO treasury MVP on Solana Devnet. It uses the Umbra Privacy SDK for registration, shielded token deposits, encrypted balance reads, anonymous UTXO disbursements, UTXO claiming, and compliance viewing grants.

Governance proposals and votes are stored in Postgres through Next.js API routes. The actual privacy operations remain client-side wallet-signed Umbra transactions.

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

## Development

```bash
npm run dev
npm run lint
npm run build
```

The app auto-creates the `shadowdao_proposals` table when the proposal API is first used.

## MVP Notes

- Proposal/vote storage is now shared via Postgres, not browser `localStorage`.
- Proposal solvency is an MVP check: the client queries the Umbra encrypted balance and only creates a proposal when the USDC balance is readable in `shared` mode and greater than the requested amount.
- Umbra signing bridges SDK `@solana/kit` transactions to wallet-adapter `VersionedTransaction` signing so real wallets can sign registration and protocol transactions.
- Compliance grant history is still local UI history; the grant/revoke/check transactions are real Umbra calls.

# Yap-Me: Decentralized Reviews as a Service

## Overview

Yap-Me is a standalone Next.js application that exposes decentralized review infrastructure as an API service. Third-party platforms integrate via API keys, and Yap-Me handles on-chain writes (Base L2), IPFS storage, and caching.

**Domain:** `yap-me.xyz` (dashboard), `api.yap-me.xyz` (API)

## Architecture

- **Stack:** Next.js, TypeScript, Prisma, PostgreSQL, Solidity (Base), Pinata (IPFS), Privy (auth)
- **Gas model:** Platforms deposit ETH credits. Yap-me relayer wallet pays gas, deducts from platform balance per tx.
- **Contract:** Single Solidity contract with platform namespacing. Only the relayer can write.

## Modules (v1)

1. **Entities** — Create/fetch places, products, creators
2. **Reviews** — Post, fetch, report reviews (3 identity modes: anonymous, platform_id, wallet)
3. **Reactions** — Cast reactions (fire, skull, love, gross, cap)

## API Surface

All `/api/v1/*` endpoints require `x-api-key` header.

### Entities
- `POST /api/v1/entities` — Create entity
- `GET /api/v1/entities` — List (paginated)
- `GET /api/v1/entities/:id` — Get entity + stats

### Reviews
- `POST /api/v1/reviews` — Post review
- `GET /api/v1/reviews` — List (filter by entityId)
- `GET /api/v1/reviews/:id` — Get single review
- `POST /api/v1/reviews/:id/report` — Report review

### Reactions
- `POST /api/v1/reactions` — Cast reaction
- `DELETE /api/v1/reactions/:id` — Remove reaction
- `GET /api/v1/reviews/:id/reactions` — Get reaction counts

### Dashboard (session auth)
- `POST /api/auth` — Privy login
- `GET/POST/DELETE /api/keys` — API key management
- `GET /api/billing` — Balance + usage
- `POST /api/billing/topup` — Top-up credits

## Smart Contract (Base L2)

Single `YapMe.sol` contract:
- `postReview(platformId, entityId, contentHash, rating, authorHash, identityMode)`
- `react(reviewId, reactorHash, reactionType)`
- `hideReview(reviewId)`
- Only relayer address can write. Events emitted for indexing.
- bytes32 hashes for cheap storage; full data on IPFS + PostgreSQL.

## Data Model

- **Platform** — Owner wallet, name, website
- **ApiKey** — Scoped to platform, `yapme_live_xxx` format
- **Balance** — Credits in wei, totalSpent
- **UsageLog** — Per-call tracking (endpoint, gasCost, txHash, status)
- **Entity** — Per-platform, name, type, category, avgRating, reviewCount
- **Review** — Content, rating, identity mode, IPFS hash, txHash
- **Reaction** — Per review, 5 types, unique per (reviewId, reactorId, type)

## Pages

- `/` — Landing page (marketing)
- `/login` — Privy wallet connect
- `/dashboard` — Overview (usage stats, balance)
- `/dashboard/keys` — API key management
- `/dashboard/billing` — Top-up + usage history
- `/dashboard/docs` — API documentation / playground

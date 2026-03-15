# StarkZap Decentralized Review Platform — Design Document

**Date:** 2026-03-15
**Status:** Draft

---

## Vision

A universal decentralized review and comment platform — like Yelp, but for everything (places, creators, products). All reviews and ratings are stored immutably on Starknet via the StarkZap SDK. The app looks and feels 100% Web2 — no wallets, no gas fees, no blockchain terminology visible to users.

**Core principle:** Users read from a fast cache, write to the blockchain. The app feels instant, but all data is permanently censorship-resistant on-chain.

---

## What Users Can Review

- **Places** — Restaurants, cafes, shops, parks (Yelp-style)
- **Creators** — YouTubers, artists, freelancers, businesses
- **Products** — Gadgets, software, courses, services
- **Anything** — Open-ended; users can create new "things" to review

Initial place data is bootstrapped via Google Places API / OpenStreetMap (hybrid approach). Users can add anything missing.

---

## Core User Actions

| Action | Storage | Details |
|--------|---------|---------|
| **Comment/Review** | On-chain | Text comment on any place/creator/product |
| **Rate** | On-chain | 1-5 star rating alongside the comment |
| **Photos** | IPFS (hash on-chain) | Upload photos with review |
| **Upvote/Downvote** | On-chain | Vote on other people's reviews |
| **Bookmark/Save** | On-chain | Save places or creators for later |
| **Follow** | On-chain | Follow a reviewer or a place for updates |
| **Report** | On-chain | Flag spam/inappropriate content |

---

## Authentication

- **Sign up:** Phone number + OTP, but the verification is **ZK-proven**:
  1. User enters phone number on their device
  2. OTP is sent and verified locally on the device
  3. A ZK proof is generated: "this person verified a valid unique phone number" — without revealing which number
  4. The proof is submitted to Starknet — the smart contract verifies it and creates the invisible wallet
  5. **Zero phone numbers stored anywhere** — not in a database, not on-chain, nowhere
- **Sign actions:** Biometric (FaceID/fingerprint) via device secure enclave. StarkZap maps biometric signature to the Starknet account.
- **Privacy guarantee:** No phone number data breach risk. No KYC liability. Just a cryptographic proof that a real, unique phone was verified.
- **No seed phrases, no wallet popups, no crypto terminology.**

---

## User Identity Modes

Users choose per-review how they appear:

- **Anonymous** — Random handle. ZK proves real human, but identity hidden.
- **Pseudonymous** — Chosen username/avatar. Review history linkable.
- **Public** — Real name visible.

Toggle available on every comment. ZK proof guarantees one-human-one-identity regardless of mode.

---

## Moderation (Censorship-Resistant)

**Community-driven hiding:**
- If enough users downvote/report a comment, the UI hides it by default
- The comment still exists on-chain — it is never deleted
- Users can toggle "show hidden" to see everything
- Moderation thresholds governed by community consensus

This respects censorship-resistance at the protocol layer while keeping the UI clean.

---

## Architecture — Three Layers

```
[User Browser]
      |
      v
[Next.js App (Vercel)]
  |-- Frontend (React, SSR)     --> What users see
  |-- API Routes (Server-side)  --> The bridge
      |
      +---> [StarkZap SDK] ---> [Starknet Blockchain]  --> The truth layer
      +---> [PostgreSQL]   ---> Cached on-chain data   --> Fast reads & search
      +---> [IPFS]         ---> Decentralized photos   --> Image storage
      +---> [Google Places] --> Bootstrap place data    --> Initial content
```

**Why this works:**
- **Reads** come from PostgreSQL cache = instant, Web2-speed
- **Writes** go to Starknet via StarkZap = immutable, censorship-proof
- **Photos** stored on IPFS = decentralized, not on-chain (too expensive)
- An indexer listens for on-chain events and syncs to PostgreSQL

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Framework** | Next.js (App Router) | Frontend + API routes in one. SSR for SEO (people search for reviews on Google) |
| **Styling** | Tailwind CSS + shadcn/ui | Clean, modern Yelp-like UI, fast to build |
| **Auth** | Phone OTP + Biometric Passkeys | StarkZap Wallets module creates invisible wallet on signup |
| **Blockchain** | StarkZap SDK (TypeScript) | Comments, ratings, votes — all on-chain, all gasless |
| **Gas Fees** | AVNU Paymaster (Gasfree mode) | Developer pays gas via API key, users pay nothing |
| **Photos** | IPFS (via Pinata or web3.storage) | Decentralized image storage, hash stored on-chain |
| **Place Data** | Google Places API + user submissions | Hybrid bootstrap for initial content |
| **Caching/Search** | PostgreSQL + Prisma | Index on-chain data for fast reads and search |
| **Maps** | Mapbox or Google Maps | Location browsing for places |
| **Hosting** | Vercel | Natural fit for Next.js |

---

## Transaction Flow (What Happens When a User Posts a Review)

```
1. User writes review + taps "Post"
2. FaceID/fingerprint confirms identity (biometric via secure enclave)
3. StarkZap SDK creates a transaction:
   - Bundles: store comment + store rating + link photos (multi-call atomicity)
4. AVNU Paymaster covers gas (Gasfree mode — developer subsidized)
5. Transaction submitted to Starknet
6. On confirmation, indexer picks up the event
7. PostgreSQL cache updated
8. UI reflects the new review instantly (optimistic update)

User sees: "Review posted!" — zero blockchain awareness.
```

---

## Smart Contract Design (High-Level)

### Entities (on-chain)

- **Entity** — A reviewable thing (place, creator, product). Has a unique ID, type, metadata hash (IPFS).
- **Review** — Linked to an Entity. Contains: text (or IPFS hash for long text), rating (1-5), author (Starknet address), timestamp, identity mode (anon/pseudo/public).
- **Vote** — Upvote or downvote on a Review. One per user per review.
- **Report** — Flag on a Review. If threshold met, UI hides by default.
- **UserProfile** — Pseudonym, bio, stats. ZK proof of unique human.

### Key Contract Functions

```
fn add_entity(entity_type, metadata_hash) -> entity_id
fn post_review(entity_id, content_hash, rating, identity_mode)
fn vote(review_id, vote_type)  // upvote or downvote
fn report(review_id, reason)
fn bookmark(entity_id)
fn follow(entity_id | user_id)
```

---

## Gasless Economics

- Starknet transaction cost: fractions of a cent per tx
- AVNU Paymaster in Gasfree mode: developer pays via API key
- Estimated cost: ~$0.001 per review/vote
- At 100K reviews/month = ~$100/month in gas costs
- Starknet Foundation Propulsion Program: up to $1M in gas reimbursements available

**This is economically viable at scale.**

---

## SEO Strategy

Since this is a Next.js app with SSR:
- Every place/creator/product page is server-rendered with full review content
- Google indexes reviews naturally
- Structured data (JSON-LD) for review rich snippets
- URL structure: `/place/[slug]`, `/creator/[slug]`, `/product/[slug]`

This is a major advantage over pure Web3 apps — search engines can find and rank this content.

---

## MVP Scope (Phase 1)

Focus on shipping the smallest useful version:

1. Phone OTP signup (invisible wallet creation)
2. Browse places (bootstrapped from Google Places for one city)
3. Post a text review + star rating (on-chain via StarkZap)
4. Upvote/downvote reviews
5. Community-driven content hiding
6. Basic search and filtering
7. Biometric signing for actions

**Not in MVP:** Photos, creators, products, follow/bookmark, ZK anonymous mode, multi-city. These come in Phase 2+.

---

## Open Questions

- [ ] Which city to bootstrap first?
- [ ] Exact ZK identity solution — Starknet ID, WorldID, or custom?
- [ ] On-chain text storage vs IPFS for review content (cost tradeoff)?
- [ ] Session keys for rapid actions (upvoting spree) or biometric per action?
- [ ] App name?

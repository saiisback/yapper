# StarkZap Decentralized Review Platform — Implementation Plan

**Date:** 2026-03-15
**Status:** Ready to build
**Design doc:** [2026-03-15-decentralized-yelp-design.md](./2026-03-15-decentralized-yelp-design.md)

---

## Phase 1 — Project Setup & Foundation

### 1.1 Initialize Next.js Project
- [ ] `npx create-next-app@latest` with App Router, TypeScript, Tailwind CSS
- [ ] Install shadcn/ui and configure theme (clean, Yelp-like — warm tones, card-based layout)
- [ ] Set up project structure:
```
src/
├── app/
│   ├── layout.tsx              # Root layout, fonts, providers
│   ├── page.tsx                # Landing / home feed
│   ├── explore/
│   │   └── page.tsx            # Map + search browse view
│   ├── place/
│   │   └── [slug]/
│   │       └── page.tsx        # Individual place page with reviews
│   ├── creator/
│   │   └── [slug]/
│   │       └── page.tsx        # Individual creator page
│   ├── product/
│   │   └── [slug]/
│   │       └── page.tsx        # Individual product page
│   ├── profile/
│   │   └── page.tsx            # User profile, their reviews, bookmarks
│   ├── api/
│   │   ├── auth/
│   │   │   └── route.ts        # ZK OTP verification endpoint
│   │   ├── places/
│   │   │   └── route.ts        # Place search, bootstrap from Google Places
│   │   ├── reviews/
│   │   │   └── route.ts        # Read cached reviews from PostgreSQL
│   │   └── indexer/
│   │       └── webhook.ts      # Receives on-chain events, updates cache
│   └── login/
│       └── page.tsx            # Phone OTP + biometric login
├── components/
│   ├── ui/                     # shadcn/ui primitives
│   ├── ReviewCard.tsx          # Single review display
│   ├── ReviewForm.tsx          # Write a review (text + stars)
│   ├── StarRating.tsx          # 1-5 star input/display
│   ├── VoteButtons.tsx         # Upvote/downvote
│   ├── EntityCard.tsx          # Place/creator/product card
│   ├── SearchBar.tsx           # Global search
│   ├── MapView.tsx             # Map embed for places
│   ├── IdentityToggle.tsx      # Anon/pseudo/public selector
│   └── NavBar.tsx              # Bottom/top navigation
├── lib/
│   ├── starkzap.ts             # StarkZap SDK initialization & helpers
│   ├── paymaster.ts            # AVNU Paymaster config
│   ├── zk-auth.ts              # ZK phone verification logic
│   ├── ipfs.ts                 # IPFS upload helpers (Pinata)
│   ├── db.ts                   # Prisma client
│   └── google-places.ts        # Google Places API wrapper
├── contracts/                  # Cairo smart contract source (separate build)
│   ├── src/
│   │   ├── entity.cairo        # Entity (place/creator/product) contract
│   │   ├── review.cairo        # Review + rating contract
│   │   ├── vote.cairo          # Upvote/downvote contract
│   │   ├── report.cairo        # Report/flag contract
│   │   ├── profile.cairo       # User profile contract
│   │   └── zk_verifier.cairo   # ZK proof verification for auth
│   └── Scarb.toml              # Cairo package manifest
└── prisma/
    └── schema.prisma           # Database schema for cache
```

### 1.2 Database Setup (PostgreSQL + Prisma)
- [ ] Set up PostgreSQL (local dev via Docker, prod via Supabase/Neon)
- [ ] Define Prisma schema:

```prisma
model Entity {
  id            String   @id              // mirrors on-chain entity_id
  type          String                    // "place" | "creator" | "product"
  name          String
  slug          String   @unique
  description   String?
  metadataHash  String?                   // IPFS hash
  latitude      Float?
  longitude     Float?
  address       String?
  category      String?
  imageUrl      String?
  avgRating     Float    @default(0)
  reviewCount   Int      @default(0)
  createdAt     DateTime @default(now())
  reviews       Review[]
  source        String   @default("user") // "google_places" | "user"
}

model Review {
  id            String   @id              // mirrors on-chain review_id
  entityId      String
  entity        Entity   @relation(fields: [entityId], references: [id])
  contentHash   String                    // IPFS hash of review text
  contentText   String                    // cached plaintext for search/display
  rating        Int                       // 1-5
  authorAddress String                    // Starknet address
  authorName    String?                   // null if anonymous
  identityMode  String                    // "anonymous" | "pseudonymous" | "public"
  upvotes       Int      @default(0)
  downvotes     Int      @default(0)
  reportCount   Int      @default(0)
  hidden        Boolean  @default(false)  // community-hidden threshold
  txHash        String                    // Starknet transaction hash
  createdAt     DateTime @default(now())
  votes         Vote[]
}

model Vote {
  id            String   @id @default(cuid())
  reviewId      String
  review        Review   @relation(fields: [reviewId], references: [id])
  voterAddress  String
  voteType      String                    // "up" | "down"
  txHash        String
  createdAt     DateTime @default(now())

  @@unique([reviewId, voterAddress])      // one vote per user per review
}

model UserProfile {
  address       String   @id              // Starknet address
  pseudonym     String?  @unique
  bio           String?
  avatarUrl     String?
  reviewCount   Int      @default(0)
  reputation    Int      @default(0)      // sum of upvotes received
  zkProofHash   String                    // proof of unique human
  createdAt     DateTime @default(now())
}
```

- [ ] Run `npx prisma migrate dev` to create tables
- [ ] Seed script to import Google Places data for initial city

---

## Phase 2 — Smart Contracts (Cairo on Starknet)

### 2.1 Entity Contract
- [ ] `add_entity(entity_type, metadata_hash) -> entity_id`
- [ ] `get_entity(entity_id) -> Entity`
- [ ] Entity types: `PLACE = 1`, `CREATOR = 2`, `PRODUCT = 3`
- [ ] Emit `EntityAdded` event for indexer

### 2.2 Review Contract
- [ ] `post_review(entity_id, content_hash, rating, identity_mode)`
  - Validates rating is 1-5
  - Validates entity exists
  - Stores review with caller's address + timestamp
  - Emit `ReviewPosted` event
- [ ] `get_review(review_id) -> Review`
- [ ] `get_reviews_by_entity(entity_id) -> Review[]`
- [ ] One review per user per entity (can update but not delete)

### 2.3 Vote Contract
- [ ] `vote(review_id, vote_type)` — upvote (1) or downvote (0)
- [ ] One vote per user per review, can change vote
- [ ] Emit `VoteCast` event
- [ ] Track net score on-chain

### 2.4 Report Contract
- [ ] `report(review_id, reason_code)`
- [ ] Track report count per review
- [ ] Emit `ReviewReported` event
- [ ] Threshold constant (e.g., 10 reports = hidden flag)

### 2.5 ZK Verifier Contract
- [ ] `verify_phone_proof(zk_proof) -> bool`
- [ ] On successful verification, create user profile entry
- [ ] Ensures one-phone-one-account (nullifier prevents reuse)
- [ ] Emit `UserVerified` event

### 2.6 Deploy & Test
- [ ] Unit tests for each contract using Cairo test framework
- [ ] Deploy to Starknet Sepolia testnet
- [ ] Verify all events emit correctly
- [ ] Test multi-call bundling: `add_entity + post_review` in single tx

---

## Phase 3 — StarkZap SDK Integration

### 3.1 SDK Initialization (`lib/starkzap.ts`)
- [ ] Install StarkZap SDK: `npm install starkzap`
- [ ] Initialize with Sepolia network config
- [ ] Configure AVNU Paymaster in Gasfree mode (developer-sponsored)
```ts
const sdk = new StarkSDK({
  network: "sepolia",
  paymaster: {
    type: "avnu",
    apiKey: process.env.AVNU_API_KEY,
    mode: "gasfree"
  }
});
```

### 3.2 Wallet & Auth (`lib/zk-auth.ts`)
- [ ] Implement phone OTP flow (Twilio/similar for SMS delivery)
- [ ] Generate ZK proof of phone verification on client side
- [ ] Submit proof to ZK Verifier contract via StarkZap
- [ ] Map verified proof to invisible Starknet wallet (Privy/Cartridge Controller)
- [ ] Store session in browser (httpOnly cookie or secure localStorage)
- [ ] Biometric passkey registration for signing actions

### 3.3 Transaction Helpers (`lib/starkzap.ts`)
- [ ] `submitReview(entityId, content, rating, identityMode)` — bundles content upload to IPFS + on-chain review post into single atomic tx
- [ ] `castVote(reviewId, voteType)` — single gasless tx
- [ ] `reportReview(reviewId, reason)` — single gasless tx
- [ ] `addEntity(type, name, metadata)` — upload metadata to IPFS + on-chain entity creation
- [ ] All functions use optimistic updates (update UI immediately, confirm in background)

### 3.4 Session Keys (for rapid actions)
- [ ] Generate session key on login — valid for 4 hours
- [ ] Permissions: vote, report only (not post reviews — those need biometric)
- [ ] Allows rapid upvote/downvote without biometric prompt each time

---

## Phase 4 — Frontend Pages

### 4.1 Login Page (`/login`)
- [ ] Phone number input field
- [ ] OTP verification screen
- [ ] Biometric passkey setup prompt (after first login)
- [ ] Loading state: "Setting up your account..." (wallet creation happening invisibly)
- [ ] Redirect to home on success

### 4.2 Home Feed (`/`)
- [ ] "Near You" section — top-rated places nearby (needs geolocation permission)
- [ ] "Trending Reviews" — most upvoted recent reviews
- [ ] "Recently Added" — newest entities
- [ ] Search bar at top
- [ ] Category filters: Restaurants, Cafes, Shops, Creators, Products

### 4.3 Explore / Map View (`/explore`)
- [ ] Full-screen map (Mapbox GL JS) with place pins
- [ ] Side panel or bottom sheet with place list
- [ ] Filter by category, rating, distance
- [ ] Search by name or address
- [ ] Clicking a pin opens place preview card

### 4.4 Entity Page (`/place/[slug]`, `/creator/[slug]`, `/product/[slug]`)
- [ ] Hero section: name, category, address/link, average rating, total reviews
- [ ] Photo gallery (Phase 2)
- [ ] Review list sorted by: Most Helpful (default), Newest, Highest, Lowest
- [ ] Each review shows: star rating, text, author (based on identity mode), upvote/downvote count, time ago
- [ ] "Write a Review" button — opens ReviewForm
- [ ] "Show hidden reviews" toggle at bottom

### 4.5 Write Review Flow
- [ ] Star rating selector (tap 1-5 stars)
- [ ] Text input (min 20 chars)
- [ ] Identity mode toggle: Anonymous / [Pseudonym] / Public
- [ ] "Post Review" button
- [ ] Biometric prompt (FaceID/fingerprint)
- [ ] Success animation — "Review posted!"
- [ ] Optimistic: review appears immediately in the list

### 4.6 User Profile (`/profile`)
- [ ] Pseudonym, avatar, bio (editable)
- [ ] "Your Reviews" tab — list of all reviews by this user
- [ ] "Bookmarks" tab (Phase 2)
- [ ] Reputation score (total upvotes received)
- [ ] Account settings

### 4.7 Search Results (`/search?q=...`)
- [ ] Full-text search across entities and review content (PostgreSQL full-text search)
- [ ] Results grouped: Places, Creators, Products
- [ ] Filter and sort options

---

## Phase 5 — Indexer (On-Chain -> Cache Sync)

### 5.1 Event Indexer Service
- [ ] Listen for Starknet events:
  - `EntityAdded` → insert into `Entity` table
  - `ReviewPosted` → insert into `Review` table, update entity `avgRating` + `reviewCount`
  - `VoteCast` → insert/update `Vote` table, update review `upvotes`/`downvotes`
  - `ReviewReported` → increment `reportCount`, set `hidden = true` if threshold met
  - `UserVerified` → insert into `UserProfile` table
- [ ] Options for indexer:
  - **Option A:** Apibara (Starknet-native indexer) — recommended
  - **Option B:** Custom polling service via Next.js cron / Vercel cron
  - **Option C:** Webhook-based via StarkZap event subscriptions
- [ ] Handle reorgs gracefully (re-index from last confirmed block)

### 5.2 Data Consistency
- [ ] Optimistic updates on write (immediate UI update)
- [ ] Indexer confirms and reconciles within ~10-30 seconds
- [ ] If tx fails, rollback optimistic update and show error toast

---

## Phase 6 — Google Places Bootstrap

### 6.1 Seed Script
- [ ] API route or CLI script: `npm run seed:places -- --city="Bangalore"`
- [ ] Fetch top places from Google Places API (paginated, by category)
- [ ] For each place:
  - Create metadata JSON, upload to IPFS
  - Submit `add_entity` transaction via StarkZap (server-side wallet with StarkSigner)
  - Insert into PostgreSQL cache
- [ ] Rate limiting: respect Google Places API quotas
- [ ] Target: 500-1000 places for launch city

### 6.2 User-Submitted Entities
- [ ] "Add a Place" / "Add a Creator" / "Add a Product" form
- [ ] Requires verified account
- [ ] On submit: IPFS upload + on-chain entity creation (gasless)
- [ ] Appears in search/browse after indexer confirms

---

## Phase 7 — Polish & Ship

### 7.1 SEO
- [ ] Server-side render all entity pages with full review content
- [ ] Add JSON-LD structured data (LocalBusiness, Review, AggregateRating schemas)
- [ ] Generate sitemap.xml from entity slugs
- [ ] Open Graph meta tags for social sharing
- [ ] URL structure: `/place/koramangala-third-wave-coffee`, `/creator/techburner`

### 7.2 PWA Setup
- [ ] Add `manifest.json` for "Add to Home Screen"
- [ ] Service worker for offline browse of cached content
- [ ] App icon and splash screen

### 7.3 Performance
- [ ] Image optimization via Next.js Image component
- [ ] ISR (Incremental Static Regeneration) for popular entity pages
- [ ] Edge caching on Vercel for API routes
- [ ] Lazy load map component

### 7.4 Error Handling
- [ ] Graceful fallback if Starknet is slow/down (show cached data, queue writes)
- [ ] Toast notifications for tx success/failure
- [ ] Retry logic for failed transactions (with backoff)

### 7.5 Analytics
- [ ] Plausible or PostHog (privacy-first analytics)
- [ ] Track: signups, reviews posted, votes cast, searches
- [ ] Monitor gas costs via AVNU dashboard

---

## Phase 8 — Future (Post-MVP)

- [ ] **Photo uploads** — IPFS via Pinata, displayed in entity gallery
- [ ] **Multi-city expansion** — City selector, geo-based auto-detection
- [ ] **Creators & Products** — Dedicated pages and browse sections
- [ ] **Follow & Bookmark** — On-chain, synced to profile
- [ ] **ZK anonymous mode** — Full anonymity with ZK proof of unique human
- [ ] **Reputation system** — Weighted reviews based on reviewer reputation
- [ ] **Notifications** — New reviews on followed entities
- [ ] **API for third parties** — Other apps can read the on-chain review data
- [ ] **Mobile app** — React Native wrapper if PWA isn't enough
- [ ] **DAO governance** — Community votes on moderation thresholds, feature priorities
- [ ] **Token incentives** — Reward quality reviewers (potential Starknet Foundation grant)

---

## Environment Variables

```env
# StarkZap / Starknet
STARKZAP_NETWORK=sepolia
AVNU_API_KEY=
STARKNET_PRIVATE_KEY=          # Server-side wallet for seeding/indexing

# Contract Addresses (after deployment)
ENTITY_CONTRACT_ADDRESS=
REVIEW_CONTRACT_ADDRESS=
VOTE_CONTRACT_ADDRESS=
REPORT_CONTRACT_ADDRESS=
ZK_VERIFIER_CONTRACT_ADDRESS=

# Database
DATABASE_URL=postgresql://...

# IPFS
PINATA_API_KEY=
PINATA_SECRET_KEY=

# Google Places
GOOGLE_PLACES_API_KEY=

# Auth / OTP
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
```

---

## Implementation Order (What to Build First)

```
Week 1:  Phase 1 — Next.js setup, Prisma schema, basic UI shell
Week 2:  Phase 2 — Cairo contracts (entity, review, vote, report)
Week 3:  Phase 3 — StarkZap SDK integration, wallet, paymaster
Week 4:  Phase 4 — Frontend pages (login, home, entity, review flow)
Week 5:  Phase 5 — Indexer + Phase 6 — Google Places seed
Week 6:  Phase 7 — SEO, PWA, polish
Week 7:  Testing, bug fixes, deploy to mainnet
```

**Ship target: 7 weeks from start.**

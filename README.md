# Yap Me. — Decentralized Review Platform

A blockchain-powered review platform built on **Starknet** that lets users rate and review places, creators, and products — with full privacy controls — while keeping the blockchain completely invisible to users.

No wallets. No gas fees. No crypto jargon. Just reviews.

## Features

- **Universal Reviews** — Rate and review places, creators, and products (1–5 stars + text + photo)
- **Privacy Controls** — Post as anonymous, pseudonymous, or public per review
- **Reactions** — React to reviews with fire, skull, love, gross, or cap
- **Proof of Presence** — Check in to locations with geolocation + photo proof, recorded on-chain
- **Google Places Integration** — Bootstrap place data from Google Places API with nearby search
- **Gasless Transactions** — All on-chain writes are subsidized via AVNU Paymaster (users pay nothing)
- **Community Moderation** — Report system with automatic hiding when threshold is exceeded
- **Sharing** — Share reviews and entities via Web Share API or clipboard
- **Immutable Record** — Reviews are permanently stored on Starknet L2, with PostgreSQL caching for instant reads

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| UI Components | shadcn/ui, Base UI, Lucide icons, Sonner toasts |
| Blockchain | Starknet L2, Cairo smart contracts, starknet.js |
| Database | PostgreSQL + Prisma ORM (read cache) |
| Storage | IPFS via Pinata (images + metadata) |
| Auth | Privy (email, Google, Apple, wallet — embedded wallets for non-crypto users) |
| APIs | Google Places API, AVNU Paymaster |
| Hosting | Vercel |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│   Next.js   │────▶│  PostgreSQL  │     │    Starknet   │
│  Frontend   │     │  (fast read) │     │   (source of  │
│  + API      │────▶│              │     │    truth)     │
│  Routes     │     └──────────────┘     └───────────────┘
│             │            ▲                     ▲
│             │            │ reconcile           │ write
│             │            │                     │
│             │     ┌──────┴──────┐       ┌──────┴──────┐
│             │────▶│   Indexer   │       │    AVNU     │
│             │     │  (webhook)  │       │  Paymaster  │
└─────────────┘     └─────────────┘       │  (gasless)  │
       │                                  └─────────────┘
       │
       ▼
┌─────────────┐
│  Pinata     │
│  (IPFS)     │
└─────────────┘
```

**Dual-Write Pattern**: Data is written to both Starknet (immutable) and PostgreSQL (fast reads). An indexer webhook reconciles any drift between the two.

## Smart Contracts (Cairo)

Seven contracts deployed on Starknet mainnet:

| Contract | Purpose |
|----------|---------|
| **Entity** | Places, creators, products (type + metadata hash) |
| **Review** | Reviews with rating, content hash, identity mode |
| **Vote** | Reactions on reviews (5 types) |
| **Report** | Community moderation / flagging |
| **Profile** | User pseudonyms + ZK proof hashes |
| **Presence** | Geolocation proof-of-attendance with photos |
| **ZK Verifier** | ZK proof verification (stub) |

Contracts are located in `src/contracts/src/` and built with [Scarb](https://docs.swmansion.com/scarb/).

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (routes)/           # Pages (home, search, explore, presence, profile)
│   │   ├── place/[slug]/   # Place detail + reviews
│   │   ├── creator/[slug]/ # Creator detail
│   │   ├── product/[slug]/ # Product detail
│   │   └── api/            # API routes (reviews, votes, feed, places, auth, presence)
│   └── layout.tsx          # Root layout (Privy, NavBar, Toaster)
├── components/             # React components (ReviewCard, ReactionBar, EntityCard, etc.)
├── lib/                    # Core logic
│   ├── starkzap.ts         # Starknet contract integration (read + write)
│   ├── ipfs.ts             # Pinata/IPFS uploads
│   ├── google-places.ts    # Google Places API
│   ├── db.ts               # Prisma client
│   └── share.ts            # Web Share API
├── contracts/              # Cairo smart contracts
│   ├── src/*.cairo          # Contract source
│   └── deployment_mainnet.json
└── utils/                  # Config helpers

prisma/
├── schema.prisma           # Database schema
└── migrations/             # Migration history
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (e.g. [Neon](https://neon.tech))
- [Scarb](https://docs.swmansion.com/scarb/) (for smart contract development)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Key variables:

```env
# Database
DATABASE_URL=postgresql://...

# Starknet
STARKNET_RPC_URL=
STARKNET_OWNER_ADDRESS=
STARKNET_PRIVATE_KEY=

# Contract addresses
ENTITY_CONTRACT_ADDRESS=
REVIEW_CONTRACT_ADDRESS=
VOTE_CONTRACT_ADDRESS=
REPORT_CONTRACT_ADDRESS=
PROFILE_CONTRACT_ADDRESS=
PRESENCE_CONTRACT_ADDRESS=

# IPFS (Pinata)
PINATA_API_KEY=
PINATA_SECRET_KEY=
PINATA_GATEWAY=

# Auth (Privy)
NEXT_PUBLIC_PRIVY_APP_ID=
PRIVY_APP_SECRET=

# Google Places
GOOGLE_PLACES_API_KEY=

# Gasless transactions
AVNU_API_KEY=
```

### 3. Set up the database

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building Smart Contracts

```bash
cd src/contracts
scarb build
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx prisma studio` | Open database GUI |

## License

All rights reserved.

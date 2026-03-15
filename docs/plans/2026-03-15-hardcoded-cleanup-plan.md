# Hardcoded & Simulation Cleanup Plan

## Decisions Made

- Gasless (AVNU paymaster) for **reviews only**, not proof of presence
- Session keys: **remove simulation**, authenticate via Privy token per request
- IPFS failure: **fail the transaction entirely**, no fake hashes on-chain
- Deployment config: **read from env vars**, keep `deployment_mainnet.json` as reference only
- Indexer IPFS: **fetch with 5s timeout**, fallback to empty, no reconciliation job
- Bundled entity+review: **split into two sequential calls** for correct entity ID
- Paymaster file + gas estimates: **delete dead code**

---

## Implementation Checklist

### 1. Environment Config

- [x] Replace hardcoded `DEPLOYMENT` object in `starkzap.ts` with `process.env` reads
- [x] Add `STARKNET_RPC_URL` and `STARKNET_OWNER_ADDRESS` to `.env` and `.env.example`
- [x] Throw on missing required env vars instead of silently failing

### 2. Remove Fake IPFS Fallbacks

- [x] `addEntityOnChain` — remove catch block with fake `Qm...` hash
- [x] `submitReviewOnChain` — remove catch blocks for content and image
- [x] `bundledEntityAndReview` — remove catch block with fake hashes
- [x] `submitPresenceProofOnChain` — remove catch block with fake photo hash
- [x] Let errors propagate; API routes already return 500

### 3. AVNU Paymaster (Reviews Only)

- [x] Add `usePaymaster` option to `executeMulticall`
- [x] Pass AVNU paymaster config when `usePaymaster: true`
- [x] `submitReviewOnChain` — enable paymaster
- [x] All other write functions — no paymaster (user pays gas)
- [x] Throw if `AVNU_API_KEY` is missing when paymaster is requested

### 4. Remove Simulated Session Keys

- [x] Delete `createSessionKey` function from `starkzap.ts`
- [x] Delete `SessionKey` type from `starkzap.ts`
- [x] Simplify `auth/route.ts` — remove session key call and response fields
- [x] Clean up any frontend references to `sessionExpiry` / `sessionKeyPermissions`

### 5. Fix Indexer IPFS Fetches

- [x] Add `fetchFromIPFS(hash, timeout)` helper with 5s AbortController timeout
- [x] `EntityAdded` — fetch metadata, use real name/slug or fallback to placeholder
- [x] `ReviewPosted` — fetch content, use real text or fallback to empty
- [x] `EventCreated` — fetch event name or fallback
- [x] `ProofRecorded` — use lat/long from on-chain event data instead of hardcoded 0

### 6. Fix bundledEntityAndReview

- [x] Split into two sequential calls: `add_entity` first, then `post_review` with real entity ID
- [x] Remove single-multicall approach with `entity_id: 0`

### 7. Delete Dead Code

- [x] Delete `src/lib/paymaster.ts` entirely
- [x] Delete `estimateGasCost` from `starkzap.ts`
- [x] Remove gas cost console.logs and response fields from `reviews/route.ts`
- [x] Remove gas cost console.logs and response fields from `votes/route.ts`
- [x] Remove `estimateGasCost` and `estimateActionCost` imports everywhere

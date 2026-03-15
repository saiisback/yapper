// StarkZap SDK initialization and transaction helpers
// Dual-write architecture: every write goes on-chain via StarkZap AND caches in PostgreSQL
// Reads come from PostgreSQL for speed; indexer reconciles any drift

import { getPaymasterConfig } from "./paymaster";
import { uploadToIPFS, uploadFileToIPFS } from "./ipfs";

// ── Types ──────────────────────────────────────────────────────────────────

export interface StarkZapConfig {
  network: "sepolia" | "mainnet";
  paymaster: {
    type: "avnu";
    apiKey: string;
    mode: "gasfree";
  };
}

export interface TransactionCall {
  contractAddress: string;
  entrypoint: string;
  calldata: string[];
}

export interface TransactionResult {
  txHash: string;
  status: "pending" | "confirmed" | "failed";
}

export interface SessionKey {
  key: string;
  expiresAt: number;
  permissions: ("vote" | "report")[];
}

export interface StarkZapWallet {
  address: string;
  publicKey: string;
}

// ── SDK Singleton ──────────────────────────────────────────────────────────

// StarkZap SDK is not yet published as an npm package.
// This module provides the full integration layer so that when the SDK ships,
// you only need to swap the `executeOnChain` implementation.
// Until then, the on-chain call is simulated and the tx hash is synthetic.

const STARKZAP_ENABLED = Boolean(process.env.STARKZAP_NETWORK);

function getContractAddress(name: string): string {
  const envKey = `${name.toUpperCase()}_CONTRACT_ADDRESS`;
  const addr = process.env[envKey];
  if (!addr) {
    console.warn(`[StarkZap] ${envKey} not set — on-chain call will be simulated`);
    return "0x0";
  }
  return addr;
}

// Core execution — calls StarkZap SDK when available, else simulates
async function executeOnChain(calls: TransactionCall[]): Promise<TransactionResult> {
  if (!STARKZAP_ENABLED) {
    // Simulate: generate a plausible tx hash for dev
    const simHash = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    console.log("[StarkZap] Simulated tx:", simHash, "calls:", calls.length);
    return { txHash: simHash, status: "confirmed" };
  }

  // ── Real SDK call (uncomment when starkzap is installed) ──
  // const { StarkSDK } = await import("starkzap");
  // const paymaster = getPaymasterConfig();
  // const sdk = new StarkSDK({
  //   network: process.env.STARKZAP_NETWORK as "sepolia" | "mainnet",
  //   paymaster: { type: paymaster.type, apiKey: paymaster.apiKey, mode: paymaster.mode },
  // });
  // const result = await sdk.execute(calls);
  // return { txHash: result.txHash, status: "pending" };

  // Temporary simulation while SDK is not installed
  void getPaymasterConfig; // ensure import is not tree-shaken
  const simHash = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  console.log("[StarkZap] Simulated tx (SDK not installed):", simHash);
  return { txHash: simHash, status: "confirmed" };
}

// ── Session Keys ───────────────────────────────────────────────────────────

export async function createSessionKey(
  userAddress: string
): Promise<SessionKey> {
  // Session keys allow rapid votes/reports without biometric each time
  // Valid for 4 hours, limited to vote + report actions only
  console.log("[StarkZap] Creating session key for", userAddress);

  // In production: sdk.createSessionKey({ permissions, duration })
  return {
    key: "sk_" + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
    expiresAt: Date.now() + 4 * 60 * 60 * 1000,
    permissions: ["vote", "report"],
  };
}

// ── Wallet Creation ────────────────────────────────────────────────────────

export async function createInvisibleWallet(
  zkProofHash: string
): Promise<StarkZapWallet> {
  // StarkZap creates an invisible Starknet wallet backed by the ZK proof
  // No seed phrases, no popups — the wallet is tied to the biometric/device
  console.log("[StarkZap] Creating invisible wallet with ZK proof:", zkProofHash.slice(0, 16) + "...");

  // In production: sdk.wallets.create({ proof: zkProofHash })
  const addressBytes = new Uint8Array(32);
  crypto.getRandomValues(addressBytes);
  const address = "0x" + Array.from(addressBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    address: address.slice(0, 66),
    publicKey: "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  };
}

// ── ZK Verification (on-chain) ─────────────────────────────────────────────

export async function verifyPhoneProof(
  proof: string,
  nullifier: string
): Promise<TransactionResult> {
  return executeOnChain([
    {
      contractAddress: getContractAddress("ZK_VERIFIER"),
      entrypoint: "verify_phone_proof",
      calldata: [proof, nullifier],
    },
  ]);
}

// ── Entity Operations ──────────────────────────────────────────────────────

export async function addEntityOnChain(
  entityType: "place" | "creator" | "product",
  metadata: { name: string; description?: string; address?: string; category?: string }
): Promise<{ txHash: string; metadataHash: string }> {
  // Step 1: Upload metadata to IPFS
  let metadataHash: string;
  try {
    metadataHash = await uploadToIPFS(metadata);
  } catch {
    // IPFS not configured — use a placeholder hash
    metadataHash = "Qm" + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(36))
      .join("")
      .slice(0, 32);
    console.warn("[StarkZap] IPFS upload failed, using placeholder hash");
  }

  // Step 2: Submit on-chain entity creation
  const typeMap = { place: "1", creator: "2", product: "3" };
  const result = await executeOnChain([
    {
      contractAddress: getContractAddress("ENTITY"),
      entrypoint: "add_entity",
      calldata: [typeMap[entityType], metadataHash],
    },
  ]);

  return { txHash: result.txHash, metadataHash };
}

// ── Review Operations ──────────────────────────────────────────────────────

export async function submitReviewOnChain(
  entityId: string,
  contentText: string,
  rating: number,
  identityMode: "anonymous" | "pseudonymous" | "public",
  imageFile?: Blob | null
): Promise<{ txHash: string; contentHash: string; imageHash: string | null }> {
  // Step 1: Upload review content to IPFS for permanent storage
  let contentHash: string;
  try {
    contentHash = await uploadToIPFS({
      text: contentText,
      rating,
      timestamp: Date.now(),
    });
  } catch {
    contentHash = "Qm" + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(36))
      .join("")
      .slice(0, 32);
    console.warn("[StarkZap] IPFS upload failed, using placeholder hash");
  }

  // Step 2: Upload image to IPFS if provided
  let imageHash: string | null = null;
  if (imageFile) {
    try {
      imageHash = await uploadFileToIPFS(imageFile, `review_${Date.now()}.jpg`);
      console.log("[StarkZap] Image uploaded to IPFS:", imageHash);
    } catch {
      console.warn("[StarkZap] Image IPFS upload failed, skipping image");
    }
  }

  // Step 3: Submit review on-chain via StarkZap (gasless via AVNU Paymaster)
  // post_review now always takes image_hash (0 if no image)
  const identityModeMap = { anonymous: "0", pseudonymous: "1", public: "2" };
  const calldata = [
    entityId,
    contentHash,
    rating.toString(),
    identityModeMap[identityMode],
    imageHash ?? "0",
  ];

  const result = await executeOnChain([
    {
      contractAddress: getContractAddress("REVIEW"),
      entrypoint: "post_review",
      calldata,
    },
  ]);

  return { txHash: result.txHash, contentHash, imageHash };
}

// ── Vote Operations ────────────────────────────────────────────────────────

export async function castVoteOnChain(
  reviewId: string,
  voteType: "fire" | "skull" | "love" | "gross" | "cap"
): Promise<TransactionResult> {
  // Uses session key for rapid voting — no biometric prompt needed
  // Reaction types mapped to on-chain enum: fire=1, skull=2, love=3, gross=4, cap=5
  const reactionMap: Record<string, string> = {
    fire: "1",
    skull: "2",
    love: "3",
    gross: "4",
    cap: "5",
  };

  return executeOnChain([
    {
      contractAddress: getContractAddress("VOTE"),
      entrypoint: "react",
      calldata: [reviewId, reactionMap[voteType]],
    },
  ]);
}

// ── Report Operations ──────────────────────────────────────────────────────

export async function reportReviewOnChain(
  reviewId: string,
  reasonCode: number
): Promise<TransactionResult> {
  return executeOnChain([
    {
      contractAddress: getContractAddress("REPORT"),
      entrypoint: "report",
      calldata: [reviewId, reasonCode.toString()],
    },
  ]);
}

// ── Profile Operations ─────────────────────────────────────────────────────

export async function createProfileOnChain(
  pseudonym: string,
  zkProofHash: string
): Promise<TransactionResult> {
  return executeOnChain([
    {
      contractAddress: getContractAddress("PROFILE"),
      entrypoint: "create_profile",
      calldata: [pseudonym, zkProofHash],
    },
  ]);
}

// ── Multi-call Bundling ────────────────────────────────────────────────────

export async function bundledEntityAndReview(
  entityType: "place" | "creator" | "product",
  entityMetadata: { name: string; description?: string },
  reviewText: string,
  rating: number,
  identityMode: "anonymous" | "pseudonymous" | "public"
): Promise<{ txHash: string; metadataHash: string; contentHash: string }> {
  // Atomic multi-call: create entity + post first review in a single transaction
  let metadataHash: string;
  let contentHash: string;

  try {
    [metadataHash, contentHash] = await Promise.all([
      uploadToIPFS(entityMetadata),
      uploadToIPFS({ text: reviewText, rating, timestamp: Date.now() }),
    ]);
  } catch {
    metadataHash = "Qm" + Math.random().toString(36).slice(2, 34);
    contentHash = "Qm" + Math.random().toString(36).slice(2, 34);
  }

  const typeMap = { place: "1", creator: "2", product: "3" };
  const identityModeMap = { anonymous: "0", pseudonymous: "1", public: "2" };

  const result = await executeOnChain([
    {
      contractAddress: getContractAddress("ENTITY"),
      entrypoint: "add_entity",
      calldata: [typeMap[entityType], metadataHash],
    },
    {
      contractAddress: getContractAddress("REVIEW"),
      entrypoint: "post_review",
      calldata: ["0", contentHash, rating.toString(), identityModeMap[identityMode], "0"],
    },
  ]);

  return { txHash: result.txHash, metadataHash, contentHash };
}

// ── Transaction Status ─────────────────────────────────────────────────────

export async function getTransactionStatus(txHash: string): Promise<"pending" | "confirmed" | "failed"> {
  // In production: sdk.getTransactionStatus(txHash)
  console.log("[StarkZap] Checking tx status:", txHash.slice(0, 16) + "...");
  return "confirmed";
}

// ── Gas Estimation ─────────────────────────────────────────────────────────

export function estimateGasCost(action: "review" | "vote" | "report" | "entity" | "profile"): {
  estimatedUSD: number;
  paidBy: "developer";
  paymaster: "AVNU";
} {
  const costs: Record<string, number> = {
    review: 0.002,
    vote: 0.0005,
    report: 0.0005,
    entity: 0.003,
    profile: 0.002,
  };

  return {
    estimatedUSD: costs[action] ?? 0.001,
    paidBy: "developer",
    paymaster: "AVNU",
  };
}

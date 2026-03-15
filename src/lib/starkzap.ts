// StarkZap — Real Starknet integration via starknet.js
// Dual-write architecture: every write goes on-chain AND caches in PostgreSQL
// Reads come from PostgreSQL for speed; indexer reconciles any drift

import {
  RpcProvider,
  Account,
  Contract,
  CallData,
  hash,
  type Call,
  type InvokeFunctionResponse,
} from "starknet";
import { uploadToIPFS, uploadFileToIPFS } from "./ipfs";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TransactionResult {
  txHash: string;
  status: "pending" | "confirmed" | "failed";
}

// ── Deployment Config (from environment) ───────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[StarkZap] Missing required env var: ${name}`);
  }
  return value;
}

function getDeployment() {
  return {
    rpc: requireEnv("STARKNET_RPC_URL"),
    owner: requireEnv("STARKNET_OWNER_ADDRESS"),
    contracts: {
      ENTITY: requireEnv("ENTITY_CONTRACT_ADDRESS"),
      REVIEW: requireEnv("REVIEW_CONTRACT_ADDRESS"),
      VOTE: requireEnv("VOTE_CONTRACT_ADDRESS"),
      REPORT: requireEnv("REPORT_CONTRACT_ADDRESS"),
      PROFILE: requireEnv("PROFILE_CONTRACT_ADDRESS"),
      PRESENCE: requireEnv("PRESENCE_CONTRACT_ADDRESS"),
    },
  };
}

// ── ABI Definitions ────────────────────────────────────────────────────────

const ENTITY_ABI = [
  {
    type: "interface",
    name: "starkzap_contracts::entity::IEntity",
    items: [
      {
        type: "function", name: "add_entity",
        inputs: [
          { name: "entity_type", type: "core::integer::u8" },
          { name: "metadata_hash", type: "core::felt252" },
        ],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "external",
      },
      {
        type: "function", name: "get_entity",
        inputs: [{ name: "entity_id", type: "core::integer::u64" }],
        outputs: [{ type: "(core::integer::u8, core::felt252, core::starknet::contract_address::ContractAddress, core::integer::u64)" }],
        state_mutability: "view",
      },
      {
        type: "function", name: "get_entity_count",
        inputs: [],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
    ],
  },
];

const REVIEW_ABI = [
  {
    type: "interface",
    name: "starkzap_contracts::review::IReview",
    items: [
      {
        type: "function", name: "post_review",
        inputs: [
          { name: "entity_id", type: "core::integer::u64" },
          { name: "content_hash", type: "core::felt252" },
          { name: "rating", type: "core::integer::u8" },
          { name: "identity_mode", type: "core::integer::u8" },
          { name: "image_hash", type: "core::felt252" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function", name: "get_review",
        inputs: [{ name: "review_id", type: "core::integer::u64" }],
        outputs: [{ type: "(core::integer::u64, core::felt252, core::integer::u8, core::starknet::contract_address::ContractAddress, core::integer::u8, core::integer::u64, core::felt252)" }],
        state_mutability: "view",
      },
      {
        type: "function", name: "get_review_count",
        inputs: [],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
      {
        type: "function", name: "get_entity_review_count",
        inputs: [{ name: "entity_id", type: "core::integer::u64" }],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
    ],
  },
];

const VOTE_ABI = [
  {
    type: "interface",
    name: "starkzap_contracts::vote::IVote",
    items: [
      {
        type: "function", name: "react",
        inputs: [
          { name: "review_id", type: "core::integer::u64" },
          { name: "reaction_type", type: "core::integer::u8" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function", name: "remove_reaction",
        inputs: [{ name: "review_id", type: "core::integer::u64" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function", name: "get_reaction_count",
        inputs: [
          { name: "review_id", type: "core::integer::u64" },
          { name: "reaction_type", type: "core::integer::u8" },
        ],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
      {
        type: "function", name: "get_user_reaction",
        inputs: [
          { name: "review_id", type: "core::integer::u64" },
          { name: "user", type: "core::starknet::contract_address::ContractAddress" },
        ],
        outputs: [{ type: "core::integer::u8" }],
        state_mutability: "view",
      },
    ],
  },
];

const REPORT_ABI = [
  {
    type: "interface",
    name: "starkzap_contracts::report::IReport",
    items: [
      {
        type: "function", name: "report",
        inputs: [
          { name: "review_id", type: "core::integer::u64" },
          { name: "reason_code", type: "core::integer::u8" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function", name: "is_hidden",
        inputs: [{ name: "review_id", type: "core::integer::u64" }],
        outputs: [{ type: "core::bool" }],
        state_mutability: "view",
      },
      {
        type: "function", name: "get_report_count",
        inputs: [{ name: "review_id", type: "core::integer::u64" }],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
    ],
  },
];

const PROFILE_ABI = [
  {
    type: "interface",
    name: "starkzap_contracts::profile::IProfile",
    items: [
      {
        type: "function", name: "create_profile",
        inputs: [
          { name: "pseudonym", type: "core::felt252" },
          { name: "zk_proof_hash", type: "core::felt252" },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function", name: "update_bio",
        inputs: [{ name: "bio_hash", type: "core::felt252" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function", name: "update_pseudonym",
        inputs: [{ name: "new_pseudonym", type: "core::felt252" }],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function", name: "get_profile",
        inputs: [{ name: "address", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [{ type: "(core::felt252, core::felt252, core::integer::u64, core::felt252)" }],
        state_mutability: "view",
      },
      {
        type: "function", name: "profile_exists",
        inputs: [{ name: "address", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [{ type: "core::bool" }],
        state_mutability: "view",
      },
    ],
  },
];

const PRESENCE_ABI = [
  {
    type: "interface",
    name: "starkzap_contracts::presence::IPresence",
    items: [
      {
        type: "function", name: "create_event",
        inputs: [
          { name: "entity_id", type: "core::integer::u64" },
          { name: "name_hash", type: "core::felt252" },
          { name: "start_time", type: "core::integer::u64" },
          { name: "end_time", type: "core::integer::u64" },
          { name: "latitude", type: "core::felt252" },
          { name: "longitude", type: "core::felt252" },
          { name: "radius", type: "core::integer::u64" },
        ],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "external",
      },
      {
        type: "function", name: "submit_proof",
        inputs: [
          { name: "entity_id", type: "core::integer::u64" },
          { name: "event_id", type: "core::integer::u64" },
          { name: "photo_hash", type: "core::felt252" },
          { name: "user_latitude", type: "core::felt252" },
          { name: "user_longitude", type: "core::felt252" },
        ],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "external",
      },
      {
        type: "function", name: "get_event",
        inputs: [{ name: "event_id", type: "core::integer::u64" }],
        outputs: [{ type: "(core::integer::u64, core::felt252, core::integer::u64, core::integer::u64, core::felt252, core::felt252, core::starknet::contract_address::ContractAddress, core::integer::u64)" }],
        state_mutability: "view",
      },
      {
        type: "function", name: "get_event_count",
        inputs: [],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
      {
        type: "function", name: "get_proof",
        inputs: [{ name: "proof_id", type: "core::integer::u64" }],
        outputs: [{ type: "(core::starknet::contract_address::ContractAddress, core::integer::u64, core::integer::u64, core::felt252, core::felt252, core::felt252, core::integer::u64)" }],
        state_mutability: "view",
      },
      {
        type: "function", name: "get_user_proof_count",
        inputs: [{ name: "user", type: "core::starknet::contract_address::ContractAddress" }],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
      {
        type: "function", name: "get_entity_proof_count",
        inputs: [{ name: "entity_id", type: "core::integer::u64" }],
        outputs: [{ type: "core::integer::u64" }],
        state_mutability: "view",
      },
      {
        type: "function", name: "get_user_entity_proof_today",
        inputs: [
          { name: "user", type: "core::starknet::contract_address::ContractAddress" },
          { name: "entity_id", type: "core::integer::u64" },
        ],
        outputs: [{ type: "core::bool" }],
        state_mutability: "view",
      },
    ],
  },
];

// ── Provider & Account Singletons ──────────────────────────────────────────

let _provider: RpcProvider | null = null;

function getProvider(): RpcProvider {
  if (!_provider) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _provider = new RpcProvider({ nodeUrl: getDeployment().rpc } as any);
  }
  return _provider;
}

let _serverAccount: Account | null = null;

function getServerAccount(): Account {
  if (!_serverAccount) {
    const privateKey = process.env.STARKNET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("[StarkZap] STARKNET_PRIVATE_KEY not set — cannot execute on-chain transactions");
    }
    _serverAccount = new Account({
      provider: getProvider(),
      address: getDeployment().owner,
      signer: privateKey,
    });
  }
  return _serverAccount;
}

// ── Contract Helpers ───────────────────────────────────────────────────────

function getContract(
  name: keyof ReturnType<typeof getDeployment>["contracts"],
  abi: unknown[],
  account?: Account
): Contract {
  const contract = new Contract({
    abi: abi as import("starknet").Abi,
    address: getDeployment().contracts[name],
    providerOrAccount: account ?? getProvider(),
  });
  return contract;
}

// ── Core Execution ─────────────────────────────────────────────────────────

async function executeMulticall(
  account: Account,
  calls: Call[],
  options?: { usePaymaster?: boolean }
): Promise<TransactionResult> {
  try {
    const executeOptions: Record<string, unknown> = {};
    if (options?.usePaymaster) {
      const avnuApiKey = process.env.AVNU_API_KEY;
      if (!avnuApiKey) {
        throw new Error("[StarkZap] AVNU_API_KEY is required for paymaster transactions");
      }
      executeOptions.paymaster = {
        type: "avnu",
        apiKey: avnuApiKey,
      };
    }

    const response: InvokeFunctionResponse = await account.execute(calls, executeOptions);
    console.log("[StarkZap] Tx submitted:", response.transaction_hash);

    // Wait for acceptance (non-blocking timeout)
    const provider = getProvider();
    try {
      await provider.waitForTransaction(response.transaction_hash, {
        retryInterval: 2000,
      });
      console.log("[StarkZap] Tx confirmed:", response.transaction_hash);
      return { txHash: response.transaction_hash, status: "confirmed" };
    } catch {
      console.warn("[StarkZap] Tx pending (timeout):", response.transaction_hash);
      return { txHash: response.transaction_hash, status: "pending" };
    }
  } catch (error) {
    console.error("[StarkZap] Tx failed:", error);
    throw error;
  }
}

// ── Entity Operations ──────────────────────────────────────────────────────

export async function addEntityOnChain(
  entityType: "place" | "creator" | "product",
  metadata: { name: string; description?: string; address?: string; category?: string }
): Promise<{ txHash: string; metadataHash: string }> {
  const metadataHash = await uploadToIPFS(metadata);

  const typeMap = { place: 1, creator: 2, product: 3 };
  const account = getServerAccount();
  const metadataFelt = stringToFelt(metadataHash);

  const result = await executeMulticall(account, [
    {
      contractAddress: getDeployment().contracts.ENTITY,
      entrypoint: "add_entity",
      calldata: CallData.compile({
        entity_type: typeMap[entityType],
        metadata_hash: metadataFelt,
      }),
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
  const contentHash = await uploadToIPFS({ text: contentText, rating, timestamp: Date.now() });

  let imageHash: string | null = null;
  if (imageFile) {
    imageHash = await uploadFileToIPFS(imageFile, `review_${Date.now()}.jpg`);
    console.log("[StarkZap] Image uploaded to IPFS:", imageHash);
  }

  const identityModeMap = { anonymous: 0, pseudonymous: 1, public: 2 };
  const account = getServerAccount();
  const entityIdNum = extractNumericId(entityId);
  const contentFelt = stringToFelt(contentHash);
  const imageFelt = imageHash ? stringToFelt(imageHash) : "0x0";

  const result = await executeMulticall(account, [
    {
      contractAddress: getDeployment().contracts.REVIEW,
      entrypoint: "post_review",
      calldata: CallData.compile({
        entity_id: entityIdNum,
        content_hash: contentFelt,
        rating,
        identity_mode: identityModeMap[identityMode],
        image_hash: imageFelt,
      }),
    },
  ], { usePaymaster: true });

  return { txHash: result.txHash, contentHash, imageHash };
}

// ── Vote Operations ────────────────────────────────────────────────────────

export async function castVoteOnChain(
  reviewId: string,
  voteType: "fire" | "skull" | "love" | "gross" | "cap"
): Promise<TransactionResult> {
  const reactionMap: Record<string, number> = {
    fire: 1, skull: 2, love: 3, gross: 4, cap: 5,
  };

  const account = getServerAccount();
  const reviewIdNum = extractNumericId(reviewId);

  return executeMulticall(account, [
    {
      contractAddress: getDeployment().contracts.VOTE,
      entrypoint: "react",
      calldata: CallData.compile({
        review_id: reviewIdNum,
        reaction_type: reactionMap[voteType],
      }),
    },
  ]);
}

// ── Report Operations ──────────────────────────────────────────────────────

export async function reportReviewOnChain(
  reviewId: string,
  reasonCode: number
): Promise<TransactionResult> {
  const account = getServerAccount();
  const reviewIdNum = extractNumericId(reviewId);

  return executeMulticall(account, [
    {
      contractAddress: getDeployment().contracts.REPORT,
      entrypoint: "report",
      calldata: CallData.compile({
        review_id: reviewIdNum,
        reason_code: reasonCode,
      }),
    },
  ]);
}

// ── Profile Operations ─────────────────────────────────────────────────────

export async function createProfileOnChain(
  pseudonym: string
): Promise<TransactionResult> {
  const account = getServerAccount();
  const pseudonymFelt = stringToFelt(pseudonym);

  return executeMulticall(account, [
    {
      contractAddress: getDeployment().contracts.PROFILE,
      entrypoint: "create_profile",
      calldata: CallData.compile({
        pseudonym: pseudonymFelt,
        zk_proof_hash: "0x0",
      }),
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
): Promise<{ entityTxHash: string; reviewTxHash: string; metadataHash: string; contentHash: string }> {
  const [metadataHash, contentHash] = await Promise.all([
    uploadToIPFS(entityMetadata),
    uploadToIPFS({ text: reviewText, rating, timestamp: Date.now() }),
  ]);

  const typeMap = { place: 1, creator: 2, product: 3 };
  const identityModeMap = { anonymous: 0, pseudonymous: 1, public: 2 };
  const account = getServerAccount();

  const metadataFelt = stringToFelt(metadataHash);
  const contentFelt = stringToFelt(contentHash);

  // Step 1: Create entity and get the real entity ID
  const entityResult = await executeMulticall(account, [
    {
      contractAddress: getDeployment().contracts.ENTITY,
      entrypoint: "add_entity",
      calldata: CallData.compile({
        entity_type: typeMap[entityType],
        metadata_hash: metadataFelt,
      }),
    },
  ]);

  // Read the new entity count to determine the entity ID
  const entityCount = await getEntityCount();
  const newEntityId = Number(entityCount);

  // Step 2: Post review with the real entity ID
  const reviewResult = await executeMulticall(account, [
    {
      contractAddress: getDeployment().contracts.REVIEW,
      entrypoint: "post_review",
      calldata: CallData.compile({
        entity_id: newEntityId,
        content_hash: contentFelt,
        rating,
        identity_mode: identityModeMap[identityMode],
        image_hash: "0x0",
      }),
    },
  ], { usePaymaster: true });

  return { entityTxHash: entityResult.txHash, reviewTxHash: reviewResult.txHash, metadataHash, contentHash };
}

// ── Presence Operations ────────────────────────────────────────────────────

export async function createPresenceEventOnChain(
  entityId: string,
  nameHash: string,
  startTime: number,
  endTime: number,
  latitude: string,
  longitude: string,
  radius: number
): Promise<TransactionResult> {
  const account = getServerAccount();
  const entityIdNum = extractNumericId(entityId);
  const nameHashFelt = stringToFelt(nameHash);

  return executeMulticall(account, [
    {
      contractAddress: getDeployment().contracts.PRESENCE,
      entrypoint: "create_event",
      calldata: CallData.compile({
        entity_id: entityIdNum,
        name_hash: nameHashFelt,
        start_time: startTime,
        end_time: endTime,
        latitude: stringToFelt(latitude),
        longitude: stringToFelt(longitude),
        radius,
      }),
    },
  ]);
}

export async function submitPresenceProofOnChain(
  entityId: string,
  eventId: string,
  photoFile: Blob | null,
  userLatitude: string,
  userLongitude: string,
  caption?: string
): Promise<{ txHash: string; photoHash: string }> {
  if (!photoFile) {
    throw new Error("[StarkZap] Photo is required for presence proof");
  }
  const photoHash = await uploadFileToIPFS(photoFile, `proof_${Date.now()}.jpg`);

  const account = getServerAccount();
  const entityIdNum = extractNumericId(entityId);
  const eventIdNum = eventId ? extractNumericId(eventId) : 0;

  const result = await executeMulticall(account, [
    {
      contractAddress: getDeployment().contracts.PRESENCE,
      entrypoint: "submit_proof",
      calldata: CallData.compile({
        entity_id: entityIdNum,
        event_id: eventIdNum,
        photo_hash: stringToFelt(photoHash),
        user_latitude: stringToFelt(userLatitude),
        user_longitude: stringToFelt(userLongitude),
      }),
    },
  ]);

  return { txHash: result.txHash, photoHash };
}

// ── Read Operations (view calls — no gas) ──────────────────────────────────

export async function getEntityFromChain(entityId: number) {
  const contract = getContract("ENTITY", ENTITY_ABI);
  return contract.call("get_entity", [entityId]);
}

export async function getReviewFromChain(reviewId: number) {
  const contract = getContract("REVIEW", REVIEW_ABI);
  return contract.call("get_review", [reviewId]);
}

export async function getEntityCount(): Promise<bigint> {
  const contract = getContract("ENTITY", ENTITY_ABI);
  return contract.call("get_entity_count") as Promise<bigint>;
}

export async function getReviewCount(): Promise<bigint> {
  const contract = getContract("REVIEW", REVIEW_ABI);
  return contract.call("get_review_count") as Promise<bigint>;
}

export async function isReviewHidden(reviewId: number): Promise<boolean> {
  const contract = getContract("REPORT", REPORT_ABI);
  return contract.call("is_hidden", [reviewId]) as Promise<boolean>;
}

export async function getReactionCount(reviewId: number, reactionType: number): Promise<bigint> {
  const contract = getContract("VOTE", VOTE_ABI);
  return contract.call("get_reaction_count", [reviewId, reactionType]) as Promise<bigint>;
}

export async function profileExists(address: string): Promise<boolean> {
  const contract = getContract("PROFILE", PROFILE_ABI);
  return contract.call("profile_exists", [address]) as Promise<boolean>;
}

export async function getPresenceEvent(eventId: number) {
  const contract = getContract("PRESENCE", PRESENCE_ABI);
  return contract.call("get_event", [eventId]);
}

export async function getPresenceProof(proofId: number) {
  const contract = getContract("PRESENCE", PRESENCE_ABI);
  return contract.call("get_proof", [proofId]);
}

export async function getPresenceEventCount(): Promise<bigint> {
  const contract = getContract("PRESENCE", PRESENCE_ABI);
  return contract.call("get_event_count") as Promise<bigint>;
}

export async function getUserProofCount(userAddress: string): Promise<bigint> {
  const contract = getContract("PRESENCE", PRESENCE_ABI);
  return contract.call("get_user_proof_count", [userAddress]) as Promise<bigint>;
}

export async function getEntityProofCount(entityId: number): Promise<bigint> {
  const contract = getContract("PRESENCE", PRESENCE_ABI);
  return contract.call("get_entity_proof_count", [entityId]) as Promise<bigint>;
}

export async function hasUserProvedToday(userAddress: string, entityId: number): Promise<boolean> {
  const contract = getContract("PRESENCE", PRESENCE_ABI);
  return contract.call("get_user_entity_proof_today", [userAddress, entityId]) as Promise<boolean>;
}

// ── Transaction Status ─────────────────────────────────────────────────────

export async function getTransactionStatus(
  txHash: string
): Promise<"pending" | "confirmed" | "failed"> {
  try {
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt.isSuccess()) return "confirmed";
    if (receipt.isReverted()) return "failed";
    return "pending";
  } catch {
    return "pending";
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────

function stringToFelt(str: string): string {
  if (str.startsWith("0x")) {
    return str.slice(0, 66);
  }
  // Short strings (≤31 chars) encode as felt directly
  if (str.length <= 31) {
    let hex = "0x";
    for (let i = 0; i < str.length; i++) {
      hex += str.charCodeAt(i).toString(16).padStart(2, "0");
    }
    return hex;
  }
  // Longer strings: hash to fit felt252
  const toHex = (s: string) => {
    let h = "0x";
    for (let i = 0; i < s.length; i++) {
      h += s.charCodeAt(i).toString(16).padStart(2, "0");
    }
    return h;
  };
  return hash.computePedersenHash(
    toHex(str.slice(0, 16)),
    toHex(str.slice(16, 31))
  );
}

function extractNumericId(id: string): number {
  const num = parseInt(id);
  if (!isNaN(num) && id === String(num)) return num;

  const parts = id.split("_");
  if (parts.length >= 2) {
    const ts = parseInt(parts[1]);
    if (!isNaN(ts)) return ts;
  }

  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

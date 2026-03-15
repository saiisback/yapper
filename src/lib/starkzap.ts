// StarkZap — Real Starknet integration via starknet.js
// Dual-write architecture: every write goes on-chain AND caches in PostgreSQL
// Reads come from PostgreSQL for speed; indexer reconciles any drift

import {
  RpcProvider,
  Account,
  Contract,
  CallData,
  hash,
  ec,
  type Call,
  type InvokeFunctionResponse,
} from "starknet";
import { uploadToIPFS, uploadFileToIPFS } from "./ipfs";

// ── Types ──────────────────────────────────────────────────────────────────

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
  privateKey: string;
}

// ── Deployment Config (mainnet) ────────────────────────────────────────────

const DEPLOYMENT = {
  rpc: "https://rpc.starknet.lava.build",
  owner: "0x014377A19eA855314FBd04D484419C9aE9f1F36897FcD170A8825E41860A0F1F",
  contracts: {
    ENTITY: "0x06d32723213dee09d61118fb2e7d9bf22153cae74355475435970c581b84b66e",
    REVIEW: "0x04d6c037cd2dff107894352e0983822e329659e83512da7fb298eb649c311a0a",
    VOTE: "0x04d18e603d70d1b3942d14b40c378f2be094b10cb2bd51506cd895bf45643f71",
    REPORT: "0x002379eae1f70c493cb50d8a6deb7aafcfb93bba44e298bc448073b3db4355de",
    PROFILE: "0x05c19d85909fb9486580b9fd74eb6ef5bdf5dd6dfc5e87a8ac3b9959f32e1840",
    ZK_VERIFIER: "0x022ca24153b30438ba90654cfe6235e4bf340ab24d534e7a39e05d7ad27c15fe",
    PRESENCE: "0x27032746857f05cb00005037c16f6bcfd6467db8cf765f4ec716ffba6f6c13b",
  },
} as const;

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

const ZK_VERIFIER_ABI = [
  {
    type: "interface",
    name: "starkzap_contracts::zk_verifier::IZkVerifier",
    items: [
      {
        type: "function", name: "verify_phone_proof",
        inputs: [
          { name: "proof", type: "core::felt252" },
          { name: "nullifier", type: "core::felt252" },
        ],
        outputs: [{ type: "core::bool" }],
        state_mutability: "external",
      },
      {
        type: "function", name: "is_verified",
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
    _provider = new RpcProvider({ nodeUrl: DEPLOYMENT.rpc } as any);
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
      address: DEPLOYMENT.owner,
      signer: privateKey,
    });
  }
  return _serverAccount;
}

// ── Contract Helpers ───────────────────────────────────────────────────────

function getContract(
  name: keyof typeof DEPLOYMENT.contracts,
  abi: unknown[],
  account?: Account
): Contract {
  const contract = new Contract({
    abi: abi as import("starknet").Abi,
    address: DEPLOYMENT.contracts[name],
    providerOrAccount: account ?? getProvider(),
  });
  return contract;
}

// ── Core Execution ─────────────────────────────────────────────────────────

async function executeMulticall(
  account: Account,
  calls: Call[]
): Promise<TransactionResult> {
  try {
    const response: InvokeFunctionResponse = await account.execute(calls);
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

// ── Wallet Creation ────────────────────────────────────────────────────────

export async function createInvisibleWallet(
  zkProofHash: string
): Promise<StarkZapWallet> {
  // Deterministically derive a Starknet keypair from the ZK proof hash
  // Same phone/user always gets the same wallet
  const seed = "0x" + zkProofHash.slice(0, 62);
  const privateKey = hash.computePedersenHash(seed, "0x1");
  const starkKey = ec.starkCurve.getStarkKey(privateKey);
  const publicKey = "0x" + starkKey;

  // Compute account address (OpenZeppelin account class hash)
  const OZ_ACCOUNT_CLASS_HASH =
    "0x061dac032f228abef9c6626f995015233097ae253a7f72d68552db02f2971b8f";
  const constructorCallData = CallData.compile({ publicKey });
  const address = hash.calculateContractAddressFromHash(
    publicKey,
    OZ_ACCOUNT_CLASS_HASH,
    constructorCallData,
    0
  );

  console.log("[StarkZap] Wallet derived:", address);

  return { address, publicKey, privateKey };
}

// ── ZK Verification ────────────────────────────────────────────────────────

export async function verifyPhoneProof(
  proof: string,
  nullifier: string
): Promise<TransactionResult> {
  const account = getServerAccount();
  const proofFelt = "0x" + proof.slice(0, 62);
  const nullifierFelt = "0x" + nullifier.slice(0, 62);

  return executeMulticall(account, [
    {
      contractAddress: DEPLOYMENT.contracts.ZK_VERIFIER,
      entrypoint: "verify_phone_proof",
      calldata: CallData.compile({
        proof: proofFelt,
        nullifier: nullifierFelt,
      }),
    },
  ]);
}

// ── Entity Operations ──────────────────────────────────────────────────────

export async function addEntityOnChain(
  entityType: "place" | "creator" | "product",
  metadata: { name: string; description?: string; address?: string; category?: string }
): Promise<{ txHash: string; metadataHash: string }> {
  let metadataHash: string;
  try {
    metadataHash = await uploadToIPFS(metadata);
  } catch {
    metadataHash = "Qm" + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(36)).join("").slice(0, 32);
    console.warn("[StarkZap] IPFS upload failed, using placeholder hash");
  }

  const typeMap = { place: 1, creator: 2, product: 3 };
  const account = getServerAccount();
  const metadataFelt = stringToFelt(metadataHash);

  const result = await executeMulticall(account, [
    {
      contractAddress: DEPLOYMENT.contracts.ENTITY,
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
  let contentHash: string;
  try {
    contentHash = await uploadToIPFS({ text: contentText, rating, timestamp: Date.now() });
  } catch {
    contentHash = "Qm" + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(36)).join("").slice(0, 32);
    console.warn("[StarkZap] IPFS upload failed, using placeholder hash");
  }

  let imageHash: string | null = null;
  if (imageFile) {
    try {
      imageHash = await uploadFileToIPFS(imageFile, `review_${Date.now()}.jpg`);
      console.log("[StarkZap] Image uploaded to IPFS:", imageHash);
    } catch {
      console.warn("[StarkZap] Image IPFS upload failed, skipping");
    }
  }

  const identityModeMap = { anonymous: 0, pseudonymous: 1, public: 2 };
  const account = getServerAccount();
  const entityIdNum = extractNumericId(entityId);
  const contentFelt = stringToFelt(contentHash);
  const imageFelt = imageHash ? stringToFelt(imageHash) : "0x0";

  const result = await executeMulticall(account, [
    {
      contractAddress: DEPLOYMENT.contracts.REVIEW,
      entrypoint: "post_review",
      calldata: CallData.compile({
        entity_id: entityIdNum,
        content_hash: contentFelt,
        rating,
        identity_mode: identityModeMap[identityMode],
        image_hash: imageFelt,
      }),
    },
  ]);

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
      contractAddress: DEPLOYMENT.contracts.VOTE,
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
      contractAddress: DEPLOYMENT.contracts.REPORT,
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
  pseudonym: string,
  zkProofHash: string
): Promise<TransactionResult> {
  const account = getServerAccount();
  const pseudonymFelt = stringToFelt(pseudonym);
  const proofFelt = "0x" + zkProofHash.slice(0, 62);

  return executeMulticall(account, [
    {
      contractAddress: DEPLOYMENT.contracts.PROFILE,
      entrypoint: "create_profile",
      calldata: CallData.compile({
        pseudonym: pseudonymFelt,
        zk_proof_hash: proofFelt,
      }),
    },
  ]);
}

// ── Session Keys ───────────────────────────────────────────────────────────

export async function createSessionKey(
  userAddress: string
): Promise<SessionKey> {
  console.log("[StarkZap] Creating session key for", userAddress);

  return {
    key: "sk_" + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0")).join(""),
    expiresAt: Date.now() + 4 * 60 * 60 * 1000,
    permissions: ["vote", "report"],
  };
}

// ── Multi-call Bundling ────────────────────────────────────────────────────

export async function bundledEntityAndReview(
  entityType: "place" | "creator" | "product",
  entityMetadata: { name: string; description?: string },
  reviewText: string,
  rating: number,
  identityMode: "anonymous" | "pseudonymous" | "public"
): Promise<{ txHash: string; metadataHash: string; contentHash: string }> {
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

  const typeMap = { place: 1, creator: 2, product: 3 };
  const identityModeMap = { anonymous: 0, pseudonymous: 1, public: 2 };
  const account = getServerAccount();

  const metadataFelt = stringToFelt(metadataHash);
  const contentFelt = stringToFelt(contentHash);

  const result = await executeMulticall(account, [
    {
      contractAddress: DEPLOYMENT.contracts.ENTITY,
      entrypoint: "add_entity",
      calldata: CallData.compile({
        entity_type: typeMap[entityType],
        metadata_hash: metadataFelt,
      }),
    },
    {
      contractAddress: DEPLOYMENT.contracts.REVIEW,
      entrypoint: "post_review",
      calldata: CallData.compile({
        entity_id: 0,
        content_hash: contentFelt,
        rating,
        identity_mode: identityModeMap[identityMode],
        image_hash: "0x0",
      }),
    },
  ]);

  return { txHash: result.txHash, metadataHash, contentHash };
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
      contractAddress: DEPLOYMENT.contracts.PRESENCE,
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
  let photoHash: string;
  try {
    if (photoFile) {
      photoHash = await uploadFileToIPFS(photoFile, `proof_${Date.now()}.jpg`);
    } else {
      throw new Error("No photo");
    }
  } catch {
    photoHash = "Qm" + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(36)).join("").slice(0, 32);
    console.warn("[StarkZap] Photo IPFS upload failed, using placeholder hash");
  }

  const account = getServerAccount();
  const entityIdNum = extractNumericId(entityId);
  const eventIdNum = eventId ? extractNumericId(eventId) : 0;

  const result = await executeMulticall(account, [
    {
      contractAddress: DEPLOYMENT.contracts.PRESENCE,
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

export async function isUserVerified(address: string): Promise<boolean> {
  const contract = getContract("ZK_VERIFIER", ZK_VERIFIER_ABI);
  return contract.call("is_verified", [address]) as Promise<boolean>;
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

// ── Gas Estimation ─────────────────────────────────────────────────────────

export function estimateGasCost(
  action: "review" | "vote" | "report" | "entity" | "profile" | "presence" | "presence_event"
): {
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
    presence: 0.002,
    presence_event: 0.003,
  };

  return {
    estimatedUSD: costs[action] ?? 0.001,
    paidBy: "developer",
    paymaster: "AVNU",
  };
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

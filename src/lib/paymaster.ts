// AVNU Paymaster configuration for gasless transactions on Starknet
// In Gasfree mode, the developer pays all gas fees via API key
// Users never see gas costs, wallet popups, or crypto terminology

export interface PaymasterConfig {
  type: "avnu";
  apiKey: string;
  mode: "gasfree";
}

export function getPaymasterConfig(): PaymasterConfig {
  const apiKey = process.env.AVNU_API_KEY;
  if (!apiKey) {
    console.warn("[AVNU Paymaster] AVNU_API_KEY not set — gasless mode unavailable, transactions will be simulated");
  }

  return {
    type: "avnu",
    apiKey: apiKey ?? "not_configured",
    mode: "gasfree",
  };
}

// Cost estimates per action on Starknet (Sepolia / Mainnet)
// These are approximate and depend on network congestion
const ACTION_COSTS: Record<string, number> = {
  review: 0.002,     // Upload to IPFS + post_review call
  vote: 0.0005,      // Single vote call (uses session key)
  report: 0.0005,    // Single report call
  entity: 0.003,     // Upload metadata to IPFS + add_entity call
  profile: 0.002,    // create_profile call
  zk_verify: 0.005,  // ZK proof verification (most expensive)
  bundle_2: 0.004,   // Multi-call: entity + review bundled
};

export function estimateActionCost(action: string): {
  estimatedUSD: number;
  paidBy: "developer";
  paymaster: "AVNU";
  network: string;
} {
  return {
    estimatedUSD: ACTION_COSTS[action] ?? 0.001,
    paidBy: "developer",
    paymaster: "AVNU",
    network: process.env.STARKZAP_NETWORK ?? "sepolia",
  };
}

export function getMonthlyGasEstimate(
  reviewsPerMonth: number,
  votesPerMonth: number,
  entitiesPerMonth: number
): { totalUSD: number; breakdown: Record<string, number> } {
  const reviewCost = reviewsPerMonth * ACTION_COSTS.review;
  const voteCost = votesPerMonth * ACTION_COSTS.vote;
  const entityCost = entitiesPerMonth * ACTION_COSTS.entity;

  return {
    totalUSD: reviewCost + voteCost + entityCost,
    breakdown: {
      reviews: reviewCost,
      votes: voteCost,
      entities: entityCost,
    },
  };
}

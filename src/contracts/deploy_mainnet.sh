#!/bin/bash
set -e

# ══════════════════════════════════════════════════════════════════════════════
# StarkZap Contracts — Starknet MAINNET Deployment
# ══════════════════════════════════════════════════════════════════════════════
#
# Prerequisites:
#   1. Install Scarb:  curl -L https://docs.swmansion.com/scarb/install.sh | sh
#   2. Install Starkli: curl https://get.starkli.sh | sh && starkliup
#   3. Create a Starknet wallet with STRK/ETH for gas fees
#   4. Set up your keystore and account:
#
#      # Create keystore from private key (you'll be prompted for password)
#      starkli signer keystore from-key ~/.starkli-wallets/deployer/keystore.json
#
#      # Fetch your account descriptor from mainnet
#      starkli account fetch <YOUR_WALLET_ADDRESS> \
#        --rpc https://starknet-mainnet.public.blastapi.io/rpc/v0_7 \
#        --output ~/.starkli-wallets/deployer/account.json
#
# Usage:
#   cd src/contracts
#   chmod +x deploy_mainnet.sh
#   ./deploy_mainnet.sh
#
# ══════════════════════════════════════════════════════════════════════════════

# ── Config ──────────────────────────────────────────────────────────────────
RPC_URL="https://starknet-mainnet.public.blastapi.io/rpc/v0_7"
KEYSTORE="$HOME/.starkli-wallets/deployer/keystore.json"
ACCOUNT="$HOME/.starkli-wallets/deployer/account.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  StarkZap — Starknet MAINNET Deployment${NC}"
echo -e "${YELLOW}══════════════════════════════════════════════════════════${NC}"
echo ""

# ── Preflight checks ───────────────────────────────────────────────────────
echo -e "${YELLOW}[1/6] Preflight checks...${NC}"

if ! command -v scarb &> /dev/null; then
    echo -e "${RED}Error: scarb not found. Install it:${NC}"
    echo "  curl -L https://docs.swmansion.com/scarb/install.sh | sh"
    exit 1
fi

if ! command -v starkli &> /dev/null; then
    echo -e "${RED}Error: starkli not found. Install it:${NC}"
    echo "  curl https://get.starkli.sh | sh && starkliup"
    exit 1
fi

if [ ! -f "$KEYSTORE" ]; then
    echo -e "${RED}Error: Keystore not found at $KEYSTORE${NC}"
    echo "Create it with:"
    echo "  starkli signer keystore from-key $KEYSTORE"
    exit 1
fi

if [ ! -f "$ACCOUNT" ]; then
    echo -e "${RED}Error: Account descriptor not found at $ACCOUNT${NC}"
    echo "Fetch it with:"
    echo "  starkli account fetch <YOUR_ADDRESS> --rpc $RPC_URL --output $ACCOUNT"
    exit 1
fi

# Get deployer address (this will be the owner of all contracts)
OWNER_ADDRESS=$(cat "$ACCOUNT" | python3 -c "import sys, json; print(json.load(sys.stdin)['deployment']['address'])" 2>/dev/null || echo "")
if [ -z "$OWNER_ADDRESS" ]; then
    echo -e "${RED}Error: Could not read deployer address from account descriptor${NC}"
    exit 1
fi

echo -e "${GREEN}  Scarb:   $(scarb --version)${NC}"
echo -e "${GREEN}  Starkli: $(starkli --version)${NC}"
echo -e "${GREEN}  Network: Starknet Mainnet${NC}"
echo -e "${GREEN}  Owner:   $OWNER_ADDRESS${NC}"
echo ""

# ── MAINNET WARNING ─────────────────────────────────────────────────────────
echo -e "${RED}⚠️  WARNING: You are deploying to STARKNET MAINNET${NC}"
echo -e "${RED}   This will cost real STRK/ETH gas fees.${NC}"
echo -e "${RED}   Contracts are IMMUTABLE once deployed.${NC}"
echo ""
read -p "Type 'mainnet' to confirm deployment: " CONFIRM
if [ "$CONFIRM" != "mainnet" ]; then
    echo "Deployment cancelled."
    exit 0
fi
echo ""

# ── Build ───────────────────────────────────────────────────────────────────
echo -e "${YELLOW}[2/6] Building contracts with Scarb...${NC}"
scarb build
echo -e "${GREEN}  Build successful.${NC}"
echo ""

# ── Output file ─────────────────────────────────────────────────────────────
DEPLOY_LOG="deployment_mainnet.json"
echo "{}" > "$DEPLOY_LOG"

# ── Helper function to declare + deploy ─────────────────────────────────────
declare_and_deploy() {
    local contract_name=$1
    local display_name=$2
    local step=$3
    local constructor_args=$4  # additional args after owner

    echo -e "${YELLOW}[$step/6] Deploying $display_name...${NC}"

    # Declare the contract class
    echo "  Declaring class..."
    local SIERRA_FILE="target/dev/starkzap_contracts_${contract_name}.contract_class.json"

    if [ ! -f "$SIERRA_FILE" ]; then
        echo -e "${RED}  Error: Sierra file not found: $SIERRA_FILE${NC}"
        exit 1
    fi

    local CLASS_HASH
    CLASS_HASH=$(starkli declare "$SIERRA_FILE" \
        --rpc "$RPC_URL" \
        --keystore "$KEYSTORE" \
        --account "$ACCOUNT" \
        2>&1 | grep -oE '0x[0-9a-fA-F]+' | head -1)

    if [ -z "$CLASS_HASH" ]; then
        echo -e "${RED}  Error declaring $display_name${NC}"
        exit 1
    fi
    echo -e "${GREEN}  Class hash: $CLASS_HASH${NC}"

    # Deploy the contract with owner as constructor arg
    echo "  Deploying..."
    local DEPLOY_OUTPUT
    DEPLOY_OUTPUT=$(starkli deploy "$CLASS_HASH" \
        "$OWNER_ADDRESS" $constructor_args \
        --rpc "$RPC_URL" \
        --keystore "$KEYSTORE" \
        --account "$ACCOUNT" \
        2>&1)

    local CONTRACT_ADDRESS
    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oE '0x[0-9a-fA-F]+' | tail -1)

    if [ -z "$CONTRACT_ADDRESS" ]; then
        echo -e "${RED}  Error deploying $display_name${NC}"
        echo "$DEPLOY_OUTPUT"
        exit 1
    fi

    echo -e "${GREEN}  Deployed at: $CONTRACT_ADDRESS${NC}"
    echo ""

    # Save to deployment log
    python3 -c "
import json
with open('$DEPLOY_LOG', 'r') as f:
    data = json.load(f)
data['$contract_name'] = {
    'class_hash': '$CLASS_HASH',
    'address': '$CONTRACT_ADDRESS'
}
with open('$DEPLOY_LOG', 'w') as f:
    json.dump(data, f, indent=2)
"

    # Return the address
    echo "$CONTRACT_ADDRESS"
}

# ── Deploy all contracts ────────────────────────────────────────────────────
# All constructors take (owner: ContractAddress) as first arg

ENTITY_ADDR=$(declare_and_deploy "EntityContract" "Entity Contract" "3")
REVIEW_ADDR=$(declare_and_deploy "ReviewContract" "Review Contract" "3")
VOTE_ADDR=$(declare_and_deploy "VoteContract" "Vote Contract" "4")
REPORT_ADDR=$(declare_and_deploy "ReportContract" "Report Contract" "4")
PROFILE_ADDR=$(declare_and_deploy "ProfileContract" "Profile Contract" "5")
ZK_VERIFIER_ADDR=$(declare_and_deploy "ZkVerifierContract" "ZK Verifier Contract" "5")

# ── Generate .env values ───────────────────────────────────────────────────
echo -e "${YELLOW}[6/6] Generating .env values...${NC}"

ENV_FILE="../../.env.mainnet"
cat > "$ENV_FILE" << EOF
# ══════════════════════════════════════════════════════════════════════════════
# StarkZap Mainnet Contract Addresses
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# Owner: $OWNER_ADDRESS
# ══════════════════════════════════════════════════════════════════════════════

STARKZAP_NETWORK=mainnet

ENTITY_CONTRACT_ADDRESS=$ENTITY_ADDR
REVIEW_CONTRACT_ADDRESS=$REVIEW_ADDR
VOTE_CONTRACT_ADDRESS=$VOTE_ADDR
REPORT_CONTRACT_ADDRESS=$REPORT_ADDR
PROFILE_CONTRACT_ADDRESS=$PROFILE_ADDR
ZK_VERIFIER_CONTRACT_ADDRESS=$ZK_VERIFIER_ADDR
EOF

echo -e "${GREEN}  .env.mainnet saved at project root.${NC}"
echo ""

# ── Summary ─────────────────────────────────────────────────────────────────
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  DEPLOYMENT COMPLETE — STARKNET MAINNET${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Entity:      $ENTITY_ADDR"
echo -e "  Review:      $REVIEW_ADDR"
echo -e "  Vote:        $VOTE_ADDR"
echo -e "  Report:      $REPORT_ADDR"
echo -e "  Profile:     $PROFILE_ADDR"
echo -e "  ZK Verifier: $ZK_VERIFIER_ADDR"
echo ""
echo -e "  Full log:  $DEPLOY_LOG"
echo -e "  Env file:  $ENV_FILE"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Copy the addresses from .env.mainnet into your .env"
echo -e "  2. Set STARKZAP_NETWORK=mainnet in .env"
echo -e "  3. Verify contracts on Starkscan/Voyager"
echo -e "  4. Set up AVNU Paymaster for gasless txs"
echo ""

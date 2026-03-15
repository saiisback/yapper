/**
 * Deploy the PresenceContract to Starknet mainnet using starknet.js
 *
 * Usage: npx tsx scripts/deploy-presence.ts
 *
 * Requires STARKNET_PRIVATE_KEY env var set to the deployer's private key.
 */

import { RpcProvider, Account, CallData, json } from "starknet";
import * as fs from "fs";
import * as path from "path";

const RPC_URL = "https://rpc.starknet.lava.build";
const DEPLOYER_ADDRESS =
  "0x014377A19eA855314FBd04D484419C9aE9f1F36897FcD170A8825E41860A0F1F";

async function main() {
  const privateKey = process.env.STARKNET_PRIVATE_KEY;
  if (!privateKey) {
    console.error("ERROR: Set STARKNET_PRIVATE_KEY env var");
    process.exit(1);
  }

  console.log("Connecting to Starknet mainnet...");
  const provider = new RpcProvider({ nodeUrl: RPC_URL } as any);
  const account = new Account({
    provider,
    address: DEPLOYER_ADDRESS,
    signer: privateKey,
  });

  // Load compiled contract artifacts
  const contractsDir = path.join(__dirname, "../src/contracts/target/dev");

  const sierraPath = path.join(
    contractsDir,
    "starkzap_contracts_PresenceContract.contract_class.json"
  );
  const casmPath = path.join(
    contractsDir,
    "starkzap_contracts_PresenceContract.compiled_contract_class.json"
  );

  if (!fs.existsSync(sierraPath) || !fs.existsSync(casmPath)) {
    console.error("ERROR: Compiled contract artifacts not found. Run 'scarb build' first.");
    process.exit(1);
  }

  const sierra = json.parse(fs.readFileSync(sierraPath, "utf-8"));
  const casm = json.parse(fs.readFileSync(casmPath, "utf-8"));

  // Step 1: Declare the contract class
  console.log("\n--- Step 1: Declaring PresenceContract ---");
  try {
    const declareResponse = await account.declare({
      contract: sierra,
      casm,
    });

    console.log("Declaration tx:", declareResponse.transaction_hash);
    console.log("Class hash:", declareResponse.class_hash);

    console.log("Waiting for declaration to be accepted...");
    await provider.waitForTransaction(declareResponse.transaction_hash);
    console.log("Declaration confirmed!");

    // Step 2: Deploy the contract
    console.log("\n--- Step 2: Deploying PresenceContract ---");
    const constructorCalldata = CallData.compile({
      owner: DEPLOYER_ADDRESS,
    });

    const deployResponse = await account.deployContract({
      classHash: declareResponse.class_hash,
      constructorCalldata,
    });

    console.log("Deploy tx:", deployResponse.transaction_hash);
    console.log("Contract address:", deployResponse.contract_address);

    console.log("Waiting for deployment to be accepted...");
    await provider.waitForTransaction(deployResponse.transaction_hash);
    console.log("Deployment confirmed!");

    // Step 3: Update deployment_mainnet.json
    console.log("\n--- Step 3: Updating deployment config ---");
    const deploymentPath = path.join(
      __dirname,
      "../src/contracts/deployment_mainnet.json"
    );
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

    deployment.contracts.PresenceContract = {
      class_hash: declareResponse.class_hash,
      address: deployResponse.contract_address,
    };

    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2) + "\n");
    console.log("Updated deployment_mainnet.json");

    console.log("\n=== Deployment Complete ===");
    console.log("Class hash:", declareResponse.class_hash);
    console.log("Address:", deployResponse.contract_address);
    console.log("Owner:", DEPLOYER_ADDRESS);
  } catch (error: any) {
    // If already declared, try to extract class hash and just deploy
    if (error?.message?.includes("already declared") || error?.message?.includes("StarknetErrorCode.CLASS_ALREADY_DECLARED")) {
      console.log("Contract class already declared, attempting deployment only...");

      // Compute class hash from sierra
      const { hash: starkHash } = await import("starknet");
      const classHash = starkHash.computeContractClassHash(sierra);
      console.log("Class hash:", classHash);

      const constructorCalldata = CallData.compile({
        owner: DEPLOYER_ADDRESS,
      });

      const deployResponse = await account.deployContract({
        classHash,
        constructorCalldata,
      });

      console.log("Deploy tx:", deployResponse.transaction_hash);
      console.log("Contract address:", deployResponse.contract_address);

      console.log("Waiting for deployment to be accepted...");
      await provider.waitForTransaction(deployResponse.transaction_hash);
      console.log("Deployment confirmed!");

      // Update deployment_mainnet.json
      const deploymentPath = path.join(
        __dirname,
        "../src/contracts/deployment_mainnet.json"
      );
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

      deployment.contracts.PresenceContract = {
        class_hash: classHash,
        address: deployResponse.contract_address,
      };

      fs.writeFileSync(
        deploymentPath,
        JSON.stringify(deployment, null, 2) + "\n"
      );
      console.log("Updated deployment_mainnet.json");

      console.log("\n=== Deployment Complete ===");
      console.log("Class hash:", classHash);
      console.log("Address:", deployResponse.contract_address);
    } else {
      console.error("Deployment failed:", error);
      process.exit(1);
    }
  }
}

main();

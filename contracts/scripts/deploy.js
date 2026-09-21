// Deploy PIPE Token to Base
// Usage: npx hardhat run scripts/deploy.js --network base

import hre from "hardhat";
import { verifyContract } from "@nomicfoundation/hardhat-verify/verify";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const connection = await hre.network.create();
const { ethers } = connection;

const TARGETS = {
  base: {
    chainId: 8453n,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    rpcEnv: "BASE_RPC_URL",
    explorer: "https://basescan.org",
    production: true,
  },
  baseSepolia: {
    chainId: 84532n,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    rpcEnv: "BASE_SEPOLIA_RPC_URL",
    explorer: "https://sepolia.basescan.org",
    production: false,
  },
};

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main() {
  const target = TARGETS[connection.networkName];
  if (!target) throw new Error("Deployment is restricted to baseSepolia or base");
  requiredEnv(target.rpcEnv);
  requiredEnv("PRIVATE_KEY");
  if (!process.env.ETHERSCAN_API_KEY?.trim() && !process.env.BASESCAN_API_KEY?.trim()) {
    throw new Error("Missing required environment variable: ETHERSCAN_API_KEY or BASESCAN_API_KEY");
  }
  const configuredOwner = ethers.getAddress(requiredEnv("OWNER_ADDRESS"));
  if (target.production && process.env.CONFIRM_BASE_MAINNET !== "DEPLOY_BASE_MAINNET") {
    throw new Error("Mainnet blocked: set CONFIRM_BASE_MAINNET=DEPLOY_BASE_MAINNET explicitly");
  }

  const liveNetwork = await ethers.provider.getNetwork();
  if (liveNetwork.chainId !== target.chainId) {
    throw new Error(`Chain mismatch: expected ${target.chainId}, received ${liveNetwork.chainId}`);
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("PIPE TOKEN DEPLOYMENT - EchoForge Texas Energy Platform");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployment signer configured");
  console.log("Deploying with account:", deployer.address);
  console.log("Final owner:", configuredOwner);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  console.log("");

  const USDC_ADDRESS = target.usdc;
  const usdcCode = await ethers.provider.getCode(USDC_ADDRESS);
  if (usdcCode === "0x") throw new Error("Canonical USDC has no code on the selected network");
  const usdc = new ethers.Contract(
    USDC_ADDRESS,
    ["function decimals() view returns (uint8)", "function symbol() view returns (string)"],
    ethers.provider
  );
  if (await usdc.decimals() !== 6n) throw new Error("Canonical USDC decimals mismatch");
  if (await usdc.symbol() !== "USDC") throw new Error("Canonical USDC symbol mismatch");
  
  console.log("Network:", connection.networkName);
  console.log("USDC Address:", USDC_ADDRESS);
  console.log("");

  // Pipeline configuration
  const INITIAL_CAPACITY_MCF = 25000; // 25,000 MCF total capacity
  const BASE_PRICE_PER_MCF = 500000; // $0.50 per MCF per day (6 decimals)

  console.log("Pipeline Configuration:");
  console.log("- Initial Capacity:", INITIAL_CAPACITY_MCF, "MCF");
  console.log("- Base Price:", BASE_PRICE_PER_MCF / 1e6, "USDC per MCF/day");
  console.log("");

  // Deploy
  console.log("Deploying PipelineCapacityToken...");
  
  const PipelineCapacityToken = await ethers.getContractFactory("PipelineCapacityToken");
  const pipe = await PipelineCapacityToken.deploy(
    USDC_ADDRESS,
    INITIAL_CAPACITY_MCF,
    BASE_PRICE_PER_MCF
  );

  await pipe.waitForDeployment();
  const pipeAddress = await pipe.getAddress();

  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("CONTRACT DEPLOYED - VALIDATION IN PROGRESS");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");
  console.log("PIPE Token Address:", pipeAddress);
  console.log("");
  console.log("Contract Details:");
  console.log("- Name:", await pipe.name());
  console.log("- Symbol:", await pipe.symbol());
  console.log("- Total Supply:", ethers.formatEther(await pipe.totalSupply()), "PIPE");
  console.log("- Max Supply:", ethers.formatEther(await pipe.MAX_SUPPLY()), "PIPE");
  console.log("");

  // Get pipeline stats
  const stats = await pipe.getPipelineStats();
  console.log("Pipeline Stats:");
  console.log("- Total Capacity:", stats[0].toString(), "MCF");
  console.log("- Available:", stats[2].toString(), "MCF");
  console.log("- Price per MCF:", (Number(stats[4]) / 1e6).toFixed(2), "USDC/day");
  console.log("");

  console.log("Waiting for block confirmations...");
  await pipe.deploymentTransaction().wait(5);

  console.log("Verifying contract on BaseScan...");
  await verifyContract({
    address: pipeAddress,
    constructorArgs: [USDC_ADDRESS, INITIAL_CAPACITY_MCF, BASE_PRICE_PER_MCF],
  }, hre);
  console.log("Contract verified!");

  console.log("Starting two-step ownership transfer...");
  await (await pipe.transferOwnership(configuredOwner)).wait();
  if (await pipe.pendingOwner() !== configuredOwner) {
    throw new Error("Pending owner verification failed");
  }

  console.log("Deployment checks passed; ownership acceptance remains pending.");

  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("NEXT STEPS:");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("1. Final owner must call acceptOwnership from the configured multisig");
  console.log("2. Independently verify the manifest and accepted owner");
  console.log("3. Complete the audit and operational approval gates");
  console.log("");
  console.log("BaseScan:", `${target.explorer}/address/${pipeAddress}`);
  console.log("");

  // Save deployment info
  const deploymentInfo = {
    network: connection.networkName,
    contractAddress: pipeAddress,
    deployer: deployer.address,
    usdcAddress: USDC_ADDRESS,
    initialCapacityMCF: INITIAL_CAPACITY_MCF,
    basePricePerMCF: BASE_PRICE_PER_MCF,
    timestamp: new Date().toISOString(),
    transactionHash: pipe.deploymentTransaction().hash,
    runtimeBytecodeHash: ethers.keccak256(await ethers.provider.getCode(pipeAddress)),
    pendingOwner: configuredOwner,
    ownershipAccepted: false,
    verified: true,
  };

  const deploymentDir = resolve("deployments");
  mkdirSync(deploymentDir, { recursive: true });
  const manifestPath = resolve(deploymentDir, `${target.chainId}-${pipeAddress}.json`);
  writeFileSync(manifestPath, `${JSON.stringify(deploymentInfo, null, 2)}\n`, { flag: "wx" });

  console.log("Deployment manifest:", manifestPath);
  console.log(JSON.stringify(deploymentInfo, null, 2));

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

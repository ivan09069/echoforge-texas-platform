// Deploy PIPE Token to Base
// Usage: npx hardhat run scripts/deploy.js --network base

const hre = require("hardhat");

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("PIPE TOKEN DEPLOYMENT - EchoForge Texas Energy Platform");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");
  console.log("");

  // USDC on Base Mainnet: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  // USDC on Base Sepolia (testnet): 0x036CbD53842c5426634e7929541eC2318f3dCF7e
  const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  
  // Use testnet USDC for testing, mainnet for production
  const isMainnet = hre.network.name === "base";
  const USDC_ADDRESS = isMainnet ? USDC_BASE_MAINNET : USDC_BASE_SEPOLIA;
  
  console.log("Network:", hre.network.name);
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
  
  const PipelineCapacityToken = await hre.ethers.getContractFactory("PipelineCapacityToken");
  const pipe = await PipelineCapacityToken.deploy(
    USDC_ADDRESS,
    INITIAL_CAPACITY_MCF,
    BASE_PRICE_PER_MCF
  );

  await pipe.waitForDeployment();
  const pipeAddress = await pipe.getAddress();

  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("DEPLOYMENT SUCCESSFUL!");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");
  console.log("PIPE Token Address:", pipeAddress);
  console.log("");
  console.log("Contract Details:");
  console.log("- Name:", await pipe.name());
  console.log("- Symbol:", await pipe.symbol());
  console.log("- Total Supply:", hre.ethers.formatEther(await pipe.totalSupply()), "PIPE");
  console.log("- Max Supply:", hre.ethers.formatEther(await pipe.MAX_SUPPLY()), "PIPE");
  console.log("");

  // Get pipeline stats
  const stats = await pipe.getPipelineStats();
  console.log("Pipeline Stats:");
  console.log("- Total Capacity:", stats[0].toString(), "MCF");
  console.log("- Available:", stats[2].toString(), "MCF");
  console.log("- Price per MCF:", (Number(stats[4]) / 1e6).toFixed(2), "USDC/day");
  console.log("");

  // Verify on BaseScan
  if (isMainnet || hre.network.name === "baseSepolia") {
    console.log("Waiting for block confirmations...");
    await pipe.deploymentTransaction().wait(5);
    
    console.log("Verifying contract on BaseScan...");
    try {
      await hre.run("verify:verify", {
        address: pipeAddress,
        constructorArguments: [
          USDC_ADDRESS,
          INITIAL_CAPACITY_MCF,
          BASE_PRICE_PER_MCF
        ],
      });
      console.log("Contract verified!");
    } catch (error) {
      console.log("Verification error:", error.message);
    }
  }

  console.log("");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("NEXT STEPS:");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("1. Add PIPE token to your wallet:", pipeAddress);
  console.log("2. Distribute tokens to initial holders");
  console.log("3. Set up staking rewards by depositing USDC");
  console.log("4. Configure capacity pricing as needed");
  console.log("5. Whitelist addresses if transfer restrictions enabled");
  console.log("");
  console.log("BaseScan:", `https://${isMainnet ? '' : 'sepolia.'}basescan.org/address/${pipeAddress}`);
  console.log("");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: pipeAddress,
    deployer: deployer.address,
    usdcAddress: USDC_ADDRESS,
    initialCapacityMCF: INITIAL_CAPACITY_MCF,
    basePricePerMCF: BASE_PRICE_PER_MCF,
    timestamp: new Date().toISOString(),
    transactionHash: pipe.deploymentTransaction().hash,
  };

  console.log("Deployment Info (save this):");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

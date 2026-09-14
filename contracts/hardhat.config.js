import "dotenv/config";
import { createRequire } from "node:module";
import { defineConfig } from "hardhat/config";
import toolbox from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [toolbox, {
    id: "pipe-root-source",
    hookHandlers: { solidity: () => import("./root-source-hooks.js") },
  }],
  solidity: {
    version: "0.8.37",
    path: require.resolve("solc/soljson.js"),
    preferWasm: true,
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: "cancun" },
  },
  paths: { sources: ["./src"], tests: { mocha: "./test" } },
  networks: {
    hardhat: { type: "edr-simulated", chainType: "l1", chainId: 31337, hardfork: "cancun" },
    base: {
      type: "http", chainType: "op", chainId: 8453,
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    baseSepolia: {
      type: "http", chainType: "op", chainId: 84532,
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  verify: { etherscan: { apiKey: process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || "" } },
  test: { mocha: { timeout: 40000 } },
});

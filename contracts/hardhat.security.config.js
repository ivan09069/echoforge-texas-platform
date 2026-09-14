import base from "./hardhat.config.js";

// Only isolated simulated networks; no RPC, accounts, or forking settings.
export default {
  ...base,
  paths: { ...base.paths, sources: ["./src", "./test/contracts"] },
  networks: { hardhat: { type: "edr-simulated", chainType: "l1", chainId: 31337, hardfork: "cancun" } },
};

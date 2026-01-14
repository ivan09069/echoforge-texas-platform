# EchoForge Texas Energy Platform

> "Drill 1 Well → Bootstrap Crypto → Reinvest Renewables"

**By Ivan Torres / EchoForge Studios**

---

## Overview

Full-stack energy trading platform combining:
- Natural gas well operations → Power generation → Bitcoin mining → Renewable reinvestment
- PIPE Token: ERC-20 tokenized pipeline capacity rights with staking rewards
- Live crypto prices from CoinGecko
- ERCOT grid monitoring
- Web3 wallet integration (MetaMask)

---

## Quick Deploy

### Prerequisites
- Node.js 18+
- MetaMask wallet
- Base Sepolia testnet ETH ([Faucet](https://www.alchemy.com/faucets/base-sepolia))

### Option 1: Full Deployment Script
```bash
chmod +x deploy.sh
./deploy.sh
```

### Option 2: Manual Steps

#### 1. Deploy PIPE Token Contract

```bash
cd contracts
cp .env.example .env
# Edit .env with your PRIVATE_KEY

npm install
npx hardhat run scripts/deploy.js --network baseSepolia
```

Save the deployed contract address.

#### 2. Update Frontend

Edit `src/App.jsx` line 18:
```javascript
const CONTRACTS = {
  PIPE: '0xYOUR_DEPLOYED_ADDRESS',  // Replace with actual address
  USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};
```

#### 3. Deploy Frontend to Vercel

```bash
npm install
npm run build
npx vercel --prod
```

---

## Contract Details

### PIPE Token (PipelineCapacityToken.sol)

| Property | Value |
|----------|-------|
| Name | Pipeline Capacity Token |
| Symbol | PIPE |
| Total Supply | 100,000 PIPE |
| Network | Base (L2) |
| Capacity per Token | 0.25 MCF |
| Total Capacity | 25,000 MCF |

### Features

**Staking**
```solidity
stake(uint256 amount, uint256 lockDays) // Min 7 days lock
unstake(uint256 amount)                  // After lock expires
claimRewards()                           // Claim USDC rewards
```

**Capacity Booking**
```solidity
bookCapacity(uint256 capacityMCF, uint256 durationDays)
cancelBooking(uint256 bookingId)
```

**Revenue Distribution**
- Pipeline usage fees collected in USDC
- Distributed pro-rata to stakers
- Automatic calculation on claim

---

## Frontend Features

- **Overview**: Bootstrap model visualization, portfolio summary
- **Wells**: Real-time production monitoring, efficiency tracking
- **Crypto**: Live prices (CoinGecko), portfolio allocation
- **Pipeline**: PIPE token staking, capacity management
- **ERCOT**: Grid status, renewable output, curtailment alerts

### Live Data Sources

| Data | Source | Update Rate |
|------|--------|-------------|
| BTC/ETH/SOL prices | CoinGecko API | 30 seconds |
| ERCOT grid | Simulated (real API requires registration) | 10 seconds |
| Contract state | Base Sepolia RPC | On-demand |

---

## Project Structure

```
echoforge-full/
├── src/
│   ├── App.jsx          # Main application
│   ├── main.jsx         # Entry point
│   └── index.css        # Tailwind styles
├── contracts/
│   ├── PipelineCapacityToken.sol
│   ├── scripts/deploy.js
│   ├── hardhat.config.js
│   └── package.json
├── dist/                # Production build
├── deploy.sh            # Deployment script
└── README.md
```

---

## Network Configuration

### Base Sepolia (Testnet)
- Chain ID: 84532
- RPC: https://sepolia.base.org
- Explorer: https://sepolia.basescan.org
- USDC: 0x036CbD53842c5426634e7929541eC2318f3dCF7e

### Base Mainnet (Production)
- Chain ID: 8453
- RPC: https://mainnet.base.org
- Explorer: https://basescan.org
- USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

---

## Next Steps

1. **Testnet**: Deploy to Base Sepolia, test all functions
2. **Security Audit**: Review contract before mainnet
3. **Mainnet**: Deploy to Base mainnet
4. **Real Data**: Integrate ERCOT API (requires account)
5. **Features**: Add trading, governance, multi-sig

---

## License

MIT - EchoForge Studios 2025

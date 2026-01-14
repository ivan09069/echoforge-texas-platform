#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# ECHOFORGE TEXAS ENERGY PLATFORM - DEPLOYMENT SCRIPT
# ═══════════════════════════════════════════════════════════════════════════════
# By Ivan Torres / EchoForge Studios
# ═══════════════════════════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "ECHOFORGE DEPLOYMENT"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "Node.js required. Install from nodejs.org"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm required."; exit 1; }

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Deploy Smart Contract
# ═══════════════════════════════════════════════════════════════════════════════
deploy_contract() {
    echo "[1/3] Deploying PIPE Token Contract to Base Sepolia..."
    echo ""
    
    cd contracts
    
    # Check for .env
    if [ ! -f .env ]; then
        echo "Creating .env from template..."
        cp .env.example .env
        echo ""
        echo "⚠️  IMPORTANT: Edit contracts/.env and add:"
        echo "   - PRIVATE_KEY (your wallet private key)"
        echo "   - BASESCAN_API_KEY (for verification)"
        echo ""
        echo "Then run this script again."
        exit 1
    fi
    
    # Install dependencies
    echo "Installing contract dependencies..."
    npm install
    
    # Compile
    echo "Compiling contracts..."
    npx hardhat compile
    
    # Deploy
    echo "Deploying to Base Sepolia..."
    npx hardhat run scripts/deploy.js --network baseSepolia
    
    cd ..
    echo ""
    echo "✓ Contract deployed!"
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Update Frontend with Contract Address
# ═══════════════════════════════════════════════════════════════════════════════
update_frontend() {
    echo "[2/3] Updating frontend with contract address..."
    
    read -p "Enter the deployed PIPE contract address: " CONTRACT_ADDRESS
    
    # Update App.jsx with the contract address
    sed -i "s/PIPE: '0x0000000000000000000000000000000000000000'/PIPE: '${CONTRACT_ADDRESS}'/" src/App.jsx
    
    echo "✓ Frontend updated with contract: $CONTRACT_ADDRESS"
}

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Deploy to Vercel
# ═══════════════════════════════════════════════════════════════════════════════
deploy_frontend() {
    echo "[3/3] Deploying frontend to Vercel..."
    echo ""
    
    # Install frontend dependencies
    echo "Installing frontend dependencies..."
    npm install
    
    # Build
    echo "Building production bundle..."
    npm run build
    
    # Check for Vercel CLI
    if ! command -v vercel >/dev/null 2>&1; then
        echo "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    # Deploy
    echo "Deploying to Vercel..."
    cd dist
    vercel --prod
    
    cd ..
    echo ""
    echo "✓ Frontend deployed!"
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════
echo "What do you want to deploy?"
echo ""
echo "1) Contract only (Base Sepolia)"
echo "2) Frontend only (Vercel)"
echo "3) Both (full deployment)"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        deploy_contract
        ;;
    2)
        deploy_frontend
        ;;
    3)
        deploy_contract
        echo ""
        update_frontend
        echo ""
        deploy_frontend
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "DEPLOYMENT COMPLETE"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Add PIPE token to your wallet"
echo "2. Get Base Sepolia testnet ETH from https://www.alchemy.com/faucets/base-sepolia"
echo "3. Distribute tokens and set up staking"
echo ""

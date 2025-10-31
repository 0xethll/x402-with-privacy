# Setup Guide

## Prerequisites

1. **Node.js & pnpm**
   ```bash
   node --version  # >= 18
   pnpm --version  # >= 8
   ```

2. **Wallets**
   - Facilitator wallet (needs ETH for gas)
   - Client wallet (needs ConfidentialUSD balance)
   - Server receiving address

3. **ConfidentialUSD Contract**
   - Deploy the contract from your fork
   - Copy contract address

## Step 1: Install Dependencies

```bash
cd /Users/hanlynn/Projects/zama/x402-with-privacy
pnpm install
```

## Step 2: Build Packages

```bash
pnpm build
```

You should see:
```
✓ @x402-privacy/types built
✓ @x402-privacy/core built
```

## Step 3: Configure Environment Variables

### Facilitator Configuration

```bash
cd apps/facilitator
cp .env.example .env
```

Edit `.env`:
```env
PORT=3000
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
FACILITATOR_PRIVATE_KEY=0x...  # Your facilitator wallet
```

### Hono Server Configuration

```bash
cd apps/hono-server
cp .env.example .env
```

Edit `.env`:
```env
PORT=4021
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PAY_TO_ADDRESS=0x...  # Where you want to receive payments
CONFIDENTIAL_USD_ADDRESS=0x...  # Your deployed ConfidentialUSD contract
FACILITATOR_PRIVATE_KEY=0x...  # Same as facilitator (or different)
FACILITATOR_URL=http://localhost:3000
```

### Client Configuration

```bash
cd apps/client
cp .env.example .env
```

Edit `.env`:
```env
SERVER_URL=http://localhost:4021
PRIVATE_KEY=0x...  # Client wallet with ConfidentialUSD balance
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

## Step 4: Test the Setup

### Terminal 1: Start Facilitator

```bash
pnpm dev:facilitator
```

Expected output:
```
🔑 Facilitator address: 0x...
🚀 Facilitator service running on http://localhost:3000

📡 Endpoints:
   POST /verify   - Verify payment
   POST /settle   - Settle payment
   GET  /supported - Get supported schemes
   GET  /health   - Health check
```

### Terminal 2: Start Hono Server

```bash
pnpm dev:server
```

Expected output:
```
🚀 Confidential X402 server running on http://localhost:4021

🔒 Protected Endpoints (Privacy-Preserving Payments):
   GET /credit-score      - 0.5 ConfidentialUSD
   GET /medical-records   - 1.0 ConfidentialUSD

💡 Privacy benefit: Payment amounts are encrypted using FHE
   Third parties cannot see how much you paid for sensitive data
```

### Terminal 3: Run Client

```bash
pnpm dev:client
```

Expected output:
```
🔒 Fetching confidential credit score with privacy-preserving payment...

👛 Wallet address: 0x...

📡 Step 1: Making initial request to /credit-score...
💳 Step 2: Payment required for sensitive data access

📋 Payment Requirements:
   Resource: Access to confidential credit score report
   Scheme: exact-confidential
   Network: sepolia
   Amount: 500000 (0.50 ConfidentialUSD)
   Pay To: 0x...

🔐 Step 3: Creating FHE encrypted payment...
   🔒 Encrypting payment amount with FHE
   🔏 Payment amount is hidden from third parties
✅ Payment header created (amount encrypted)

📡 Step 4: Retrying request with confidential payment...

✅ Payment successful! Access granted to sensitive data

🔒 Credit Score Report (Confidential):
{
  "userId": "anonymous",
  "creditScore": 750,
  "rating": "Good",
  "factors": {
    "paymentHistory": "Excellent",
    "creditUtilization": "28%",
    ...
  },
  "disclaimer": "This is confidential financial information. Payment was made privately using FHE encryption."
}

✨ Done!

💡 Privacy Note:
   Your payment amount was encrypted using FHE (Fully Homomorphic Encryption)
   No one can see how much you paid to access your credit score
   This protects your financial privacy!
```

## Step 5: Verify On-Chain

Check the transaction on block explorer:
- Network: Zama fhEVM Devnet
- Transaction hash: (from logs)
- Function: `transferWithAuthorization`

## Troubleshooting

### Error: "Insufficient balance"

**Problem**: Client wallet doesn't have ConfidentialUSD tokens

**Solution**:
1. Mint tokens using your contract's `mint()` function
2. Encrypt amount: `fhevmjs.encrypt(1000000)`
3. Call `mint(clientAddress, encryptedAmount, proof)`

### Error: "Invalid signature"

**Problem**: Network mismatch or wrong contract address

**Solution**:
1. Check `CONFIDENTIAL_USD_ADDRESS` matches deployed contract
2. Verify network is correct (`sepolia` vs `base-sepolia`)
3. Check `extra.name` and `extra.version` in PaymentRequirements

### Error: "Nonce already used"

**Problem**: Replayed payment or duplicate nonce

**Solution**:
1. Restart client (generates new nonce)
2. Check if transaction already succeeded on-chain

### Error: "Failed to decrypt transferred amount"

**Problem**: Facilitator doesn't have decryption permission

**Solution**:
1. Verify `facilitator` address is set correctly in contract constructor
2. Check `FHE.allow(transferred, facilitator)` is called in contract

## Next Steps

1. **Deploy Your Contract**
   - Add contract code to `contracts/` directory
   - Deploy to fhEVM testnet
   - Update `.env` files with new address

2. **Customize Routes**
   - Edit `apps/hono-server/src/index.ts`
   - Add more protected endpoints
   - Configure different prices per route

3. **Test Error Cases**
   - Try payment with insufficient balance
   - Test expired authorizations
   - Verify nonce replay protection

4. **Add Features**
   - Implement client-side balance checking
   - Add payment history tracking
   - Build admin dashboard

## Development Commands

```bash
# Build all packages
pnpm build

# Type checking
pnpm typecheck

# Clean build artifacts
pnpm clean

# Install new dependency
pnpm add <package> --filter @x402-privacy/<app-name>
```

## Resources

- [X402 Protocol](https://x402.org)
- [Zama fhEVM Docs](https://docs.zama.ai/fhevm)
- [fhevmjs Library](https://github.com/zama-ai/fhevmjs)
- [EIP-712 Spec](https://eips.ethereum.org/EIPS/eip-712)
- [EIP-3009 Spec](https://eips.ethereum.org/EIPS/eip-3009)

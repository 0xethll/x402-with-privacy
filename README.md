## The EIP712 compatible confidential contract is written at https://github.com/0xethll/zama-starter/blob/main/contracts/contracts/cUSDX402.sol ##

# X402 with Privacy

Privacy-preserving payment protocol for sensitive data APIs, built on X402 and Zama's fhEVM (Fully Homomorphic Encryption).

## 💡 Why Privacy-Preserving Payments?

When accessing sensitive information like **credit scores**, **medical records**, or **financial data**, traditional payments reveal:
- 🔍 How much you paid (reveals the value of information)
- 🔍 When you accessed it (reveals your behavior patterns)
- 🔍 What you're interested in (reveals your concerns)

**With FHE encryption**, payment amounts are **completely hidden**:
- ✅ No one can see how much you paid to check your credit score
- ✅ No one knows which medical records you accessed
- ✅ Your financial privacy is protected on-chain

## 🎯 Features

- ✅ **Complete Privacy**: Payment amounts encrypted using FHE (Fully Homomorphic Encryption)
- ✅ **X402 Compatible**: Implements the X402 protocol specification
- ✅ **No Gas for Users**: Facilitator pays transaction gas fees
- ✅ **EIP-712 Signatures**: User-friendly structured data signing
- ✅ **Monorepo Structure**: Clean separation of concerns
- ✅ **Privacy-First Examples**: Credit score and medical records APIs

## 📦 Project Structure

```
x402-with-privacy/
├── packages/
│   ├── confidential-x402-types/    # TypeScript type definitions
│   └── confidential-x402-core/     # Core payment logic
├── apps/
│   ├── hono-server/                # Payment-protected Hono server
│   ├── client/                     # Example client application
│   └── facilitator/                # Facilitator service
├── contracts/                      # (To be added) Solidity contracts
└── package.json
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- Deployed ConfidentialUSD contract on fhEVM testnet

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Configuration

1. **Facilitator** (`apps/facilitator/.env`):
```env
PORT=3000
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
FACILITATOR_PRIVATE_KEY=0x...
```

2. **Hono Server** (`apps/hono-server/.env`):
```env
PORT=4021
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PAY_TO_ADDRESS=0x...
CONFIDENTIAL_USD_ADDRESS=0x...
FACILITATOR_PRIVATE_KEY=0x...
```

3. **Client** (`apps/client/.env`):
```env
SERVER_URL=http://localhost:4021
PRIVATE_KEY=0x...
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

### Running the Example

```bash
# Terminal 1: Start Facilitator
pnpm dev:facilitator

# Terminal 2: Start Hono Server
pnpm dev:server

# Terminal 3: Run Client
pnpm dev:client
```

## 📖 How It Works

### Payment Flow

```
1. Client → GET /weather → Server
   Response: 402 Payment Required + PaymentRequirements

2. Client creates FHE-encrypted payment:
   - Encrypt amount using fhEVM
   - Sign with EIP-712 (no plaintext amount!)
   - Generate X-PAYMENT header

3. Client → GET /weather + X-PAYMENT → Server
   Server → Verify signature → Facilitator

4. Server executes business logic

5. Server → Settle payment → Facilitator → Blockchain
   - Facilitator calls ConfidentialUSD.transferWithAuthorization()
   - FHE ensures amount privacy
   - Returns encrypted transferred amount

6. Facilitator decrypts result:
   - If transferred = 0 → insufficient balance
   - If transferred < expected → partial transfer
   - If transferred = expected → success!

7. Server → 200 OK + Data + X-PAYMENT-RESPONSE → Client
```

### Key Privacy Features

- **Encrypted Amounts**: Payment amounts are encrypted client-side using FHE
- **No Plaintext in Signature**: EIP-712 signature uses `encryptedValueHandle` (bytes32 commitment)
- **On-Chain Privacy**: Balances and transfer amounts remain encrypted on-chain
- **Facilitator Verification**: Facilitator only sees encrypted data during verification
- **Post-Transfer Decryption**: Facilitator decrypts `transferred` amount only after settlement

## 🔧 Development

### Build Packages

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @x402-privacy/core build
```

### Type Checking

```bash
pnpm typecheck
```

### Clean

```bash
pnpm clean
```

## 📝 Package Overview

### @x402-privacy/types

Core TypeScript types for the protocol:
- `PaymentPayload`, `PaymentRequirements`
- `Authorization`, `VerifyResponse`, `SettleResponse`
- Network and scheme definitions

### @x402-privacy/core

Core payment logic:
- `createPaymentHeader()` - Client-side payment creation
- `verifyConfidentialPayment()` - Signature verification
- `settleConfidentialPayment()` - On-chain settlement

### @x402-privacy/hono-server

Hono server with confidential payment middleware:
- `confidentialPaymentMiddleware()` - Drop-in middleware
- Route-based payment configuration
- Automatic verify & settle flow

### @x402-privacy/client

Example client application:
- Demonstrates end-to-end payment flow
- FHE encryption integration
- Error handling

### @x402-privacy/facilitator

Standalone facilitator service:
- `/verify` - Verify payment signatures
- `/settle` - Settle on-chain payments
- `/supported` - List supported schemes

## 🔐 Security Considerations

1. **Balance Privacy**: Client balances are encrypted, but transfer success/failure leaks information
2. **Amount Privacy**: Payment amounts are encrypted in transit and on-chain
3. **Facilitator Trust**: Facilitator can decrypt `transferred` amounts after settlement
4. **Gas Costs**: Failed transactions still consume gas (MVP accepts this tradeoff)

## 🚧 Limitations (MVP)

- ❌ No pre-verification of encrypted balances
- ❌ Failed transactions waste gas
- ❌ Facilitator can see final transferred amounts
- ❌ No support for dynamic pricing
- ❌ Single FHE scheme only

## 🗺️ Roadmap

- [ ] Deploy ConfidentialUSD contract to testnet
- [ ] Add contract deployment scripts
- [ ] Implement client-side balance pre-check
- [ ] Add ZK proofs for balance verification
- [ ] Support multiple FHE schemes
- [ ] Add comprehensive tests
- [ ] Production-ready error handling

## 📄 License

MIT

## 🙏 Acknowledgments

- [X402 Protocol](https://x402.org) - HTTP-native payment standard
- [Zama fhEVM](https://github.com/zama-ai/fhevm) - Confidential smart contracts
- [Coinbase X402](https://github.com/coinbase/x402) - Original implementation

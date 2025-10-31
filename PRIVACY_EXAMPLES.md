# Privacy-Preserving Payment Examples

This document explains how privacy-preserving payments protect sensitive data access.

## 🔒 Why Privacy Matters for Sensitive Data

Traditional blockchain payments are **completely transparent**. When you pay to access sensitive information, everyone can see:

1. **Payment Amount** → Reveals how valuable the data is to you
2. **Timestamp** → Reveals when you accessed sensitive information
3. **Frequency** → Reveals patterns of your behavior
4. **Recipient** → Reveals which services you're using

### Real-World Privacy Concerns

#### Example 1: Credit Score Access
**Without Privacy:**
```
Transaction: 0xabc123...
From: 0xAlice...
To: CreditBureau
Amount: 0.5 USD
```
❌ **Everyone can see**: Alice paid $0.50 to check her credit score
❌ **Inference**: She might be applying for a loan or worried about her credit
❌ **Risk**: Insurance companies, lenders could track this behavior

**With FHE Privacy:**
```
Transaction: 0xdef456...
From: 0xAlice...
To: CreditBureau
Amount: 0x7f8e9d... (encrypted)
```
✅ **No one can see**: How much Alice paid
✅ **Protected**: Her financial concerns remain private
✅ **Secure**: Only the contract knows the actual amount

---

#### Example 2: Medical Records Access
**Without Privacy:**
```
Transaction: 0x789abc...
From: 0xBob...
To: HealthClinic
Amount: 1.0 USD
```
❌ **Everyone can see**: Bob paid $1 to access medical records
❌ **Inference**: He might have a health condition
❌ **Risk**: Health insurance discrimination, employment bias

**With FHE Privacy:**
```
Transaction: 0x123def...
From: 0xBob...
To: HealthClinic
Amount: 0xa1b2c3... (encrypted)
```
✅ **No one can see**: What Bob paid for
✅ **Protected**: His health information access is private
✅ **Secure**: HIPAA-compliant privacy on-chain

---

## 🎯 How Our Implementation Works

### Architecture

```
┌─────────┐                          ┌──────────────┐
│  Client │                          │ Hono Server  │
│         │                          │              │
│ 1. FHE  │ ─── X-PAYMENT header ──> │ 2. Verify   │
│ Encrypt │ <── 402 Payment Req. ─── │    via      │
│ Amount  │                          │    Facilitator│
└─────────┘                          └──────────────┘
                                           │
                                           ↓
                                    ┌──────────────┐
                                    │ Facilitator  │
                                    │              │
                                    │ 3. Execute   │
                                    │    on-chain  │
                                    │              │
                                    │ 4. Decrypt   │
                                    │    result    │
                                    └──────────────┘
```

### Key Privacy Features

1. **Client-Side Encryption**: Amount is encrypted with FHE before leaving the client
2. **Encrypted Signature**: EIP-712 signature includes encrypted handle, not plaintext
3. **On-Chain Privacy**: Contract receives and processes encrypted amounts
4. **Facilitator Decryption**: Only facilitator can decrypt the transfer result
5. **Zero-Knowledge Balance**: No one can see user's token balance

---

## 📊 Privacy Comparison

| Feature | Traditional Payment | FHE Payment (Ours) |
|---------|-------------------|-------------------|
| Payment Amount | 👁️ Visible to all | 🔒 Encrypted |
| Balance Check | 👁️ Public | 🔒 Encrypted |
| Transfer Amount | 👁️ Public | 🔒 Encrypted |
| Settlement Result | 👁️ Public | 🔒 Decrypted only by facilitator |
| Data Access Pattern | 👁️ Trackable | ✅ Private |
| User Behavior | 👁️ Analyzable | ✅ Protected |

---

## 🔐 Example Endpoints

### 1. Credit Score API
```http
GET /credit-score HTTP/1.1
X-PAYMENT: <base64-encoded-encrypted-payment>
```

**Use Cases:**
- Credit monitoring services
- Loan application portals
- Financial planning apps
- Identity verification

**Privacy Benefit:**
- Lenders can't track how often you check your credit
- Insurance companies can't see your credit monitoring habits
- Employers can't discriminate based on credit checks

---

### 2. Medical Records API
```http
GET /medical-records HTTP/1.1
X-PAYMENT: <base64-encoded-encrypted-payment>
```

**Use Cases:**
- Patient portals
- Telemedicine platforms
- Insurance claims
- Health research

**Privacy Benefit:**
- Insurance companies can't see which records you access
- Prevents health discrimination
- HIPAA-compliant privacy
- Protected against data brokers

---

## 💻 Code Example

### Client: Encrypting Payment

```typescript
// Initialize FHE client
await initFHEVM();
const client = await createFHEVMClient({
  network: "sepolia",
  provider: RPC_URL,
});

// Encrypt payment amount
const { handle, proof } = await client.encrypt.uint64({
  value: 500000n, // 0.5 ConfidentialUSD
  contractAddress: CONFIDENTIAL_USD_ADDRESS,
  userAddress: wallet.address,
});

// Sign with encrypted handle (NOT plaintext!)
const signature = await wallet.signTypedData({
  domain,
  types,
  message: {
    from: wallet.address,
    to: server.address,
    encryptedValueHandle: handle, // ← Encrypted!
    validAfter,
    validBefore,
    nonce,
  },
});
```

### Facilitator: Settling Payment

```typescript
// Execute on-chain transfer with encrypted amount
const tx = await contract.write.transferWithAuthorization([
  from,
  to,
  encryptedValueHandle, // ← Still encrypted!
  inputProof,
  validAfter,
  validBefore,
  nonce,
  signature,
]);

// Wait for confirmation
const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

// Decrypt the result (only facilitator can do this)
const transferred = await fhevmClient.decrypt({
  ciphertextHandle: receipt.logs[0].transferred,
  contractAddress: CONTRACT_ADDRESS,
  walletClient: facilitatorWallet,
});

if (transferred === 0n) {
  // Insufficient balance (privacy preserved!)
}
```

---

## 🌟 Privacy Guarantees

### What is Hidden

✅ Payment amount (encrypted with FHE)
✅ User balance (encrypted with FHE)
✅ Transfer amount (encrypted with FHE)
✅ Settlement result (only facilitator can decrypt)

### What is Visible

⚠️ Transaction sender address
⚠️ Transaction recipient address
⚠️ Transaction timestamp
⚠️ Gas fees paid

### Trade-offs

- **Privacy**: Maximum - payment amounts completely hidden
- **Performance**: Slightly slower due to FHE operations
- **Cost**: Higher gas fees for FHE operations
- **Usability**: Requires FHE-enabled token contract

---

## 🎓 Educational Use Cases

This implementation demonstrates:

1. **FHE in Action**: Real-world use of Fully Homomorphic Encryption
2. **X402 Protocol**: HTTP-native payment integration
3. **Privacy Engineering**: Building privacy-first applications
4. **Sensitive Data**: Protecting user privacy when accessing confidential information

---

## 🔗 Resources

- [Zama fhEVM Documentation](https://docs.zama.ai/fhevm)
- [X402 Protocol Specification](https://x402.org)
- [EIP-712 Typed Data Signing](https://eips.ethereum.org/EIPS/eip-712)
- [EIP-3009 Transfer With Authorization](https://eips.ethereum.org/EIPS/eip-3009)

---

## ⚖️ Legal & Compliance

This privacy-preserving payment system helps comply with:

- **GDPR**: Protects financial transaction data
- **HIPAA**: Enables privacy-compliant health data payments
- **CCPA**: Respects user privacy preferences
- **Financial Privacy**: Protects sensitive financial information

---

## 🚀 Try It Yourself

```bash
# Start the services
pnpm dev:facilitator  # Terminal 1
pnpm dev:server       # Terminal 2
pnpm dev:client       # Terminal 3

# Access credit score with privacy-preserving payment
# Watch the encrypted payment flow!
```

---

**Built with ❤️ for Privacy**

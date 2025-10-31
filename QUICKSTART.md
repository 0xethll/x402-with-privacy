# Quick Start Guide

## Project structure

```
x402-with-privacy/
├── packages/
│   ├── confidential-x402-types/    # 🔷 Type definition
│   │   └── src/index.ts            #    - PaymentPayload, PaymentRequirements, etc.
│   │
│   └── confidential-x402-core/     # 🔷 Core
│       ├── src/client/             #    - createPaymentHeader
│       ├── src/facilitator/        #    - verify & settle
│       └── src/utils/              #    - encoding, network tools
│
├── apps/
│   ├── hono-server/                # 🚀 Hono server
│   │   ├── src/middleware.ts       #    - confidentialPaymentMiddleware
│   │   └── src/index.ts            #    - /weather example endpoint
│   │
│   ├── client/                     # 💻 Client
│   │   └── src/index.ts            #    - Complete payment process demonstration
│   │
│   └── facilitator/                # ⚙️ Facilitator service
│       └── src/index.ts            #    - /verify, /settle endpoints
│
├── README.md                       
├── SETUP.md                        
└── QUICKSTART.md                   
```

## One-click start (3 steps)

### 1. Install dependencies

```bash
pnpm install && pnpm build
```

### 2. Configure environment variables

**Minimum configuration** :

```bash
# apps/facilitator/.env
FACILITATOR_PRIVATE_KEY=0xYourFacilitatorKey

# apps/hono-server/.env
PAY_TO_ADDRESS=0xYourReceivingAddress
CONFIDENTIAL_USD_ADDRESS=0xYourContractAddress
FACILITATOR_PRIVATE_KEY=0xSameOrDifferentKey

# apps/client/.env
PRIVATE_KEY=0xYourClientKey
```

### 3. Run

```bash
# terminal 1
pnpm dev:facilitator

# terminal 2
pnpm dev:server

# terminal 3
pnpm dev:client
```

## Interpretation of core documents

### 1. Type definition (`packages/confidential-x402-types/src/index.ts`)

```typescript
// The 3 most important types:

// 1. Authorization parameters (excluding plaintext value!)
interface Authorization {
  from: string;
  to: string;
  encryptedValueHandle: string; 
  inputProof: string;            
  validAfter: string;
  validBefore: string;
  nonce: string;
}

// 2. Payment payload
interface PaymentPayload {
  x402Version: number;
  scheme: "exact-confidential";
  network: Network;
  payload: {
    signature: string;            // ← EIP-712 sig
    authorization: Authorization;
  };
}

// 3. Payment Requirements
interface PaymentRequirements {
  scheme: "exact-confidential";
  network: Network;
  maxAmountRequired: string;      // ← the client will be encrypted!
  payTo: string;
  asset: string;                  // ← ConfidentialUSD address
  // ...
}
```

### 2. Client Signature (`packages/confidential-x402-core/src/client/createPaymentHeader.ts`)

```typescript
export async function createPaymentHeader(
  wallet: Wallet,
  options: CreatePaymentHeaderOptions,
  fhevmConfig: FhevmConfig
): Promise<string> {
  // 1. FHE Encrypted Amount
  const fhevmInstance = await createInstance(fhevmConfig);
  const input = fhevmInstance.createEncryptedInput(...);
  input.add64(plaintextAmount);
  const { handles, inputProof } = await input.encrypt();

  // 2. EIP-712 signature (using handle instead of plaintext value)
  const signature = await wallet.signTypedData(domain, types, {
    from, to,
    encryptedValueHandle: handles[0],
    validAfter, validBefore, nonce
  });

  // 3. Build and code
  return encodePaymentPayload({ signature, authorization: { ... } });
}
```

### 3. Facilitator settlement (`packages/confidential-x402-core/src/facilitator/settle.ts`)

```typescript
export async function settleConfidentialPayment(...) {
  // 1. Calling contract
  const tx = await contract.transferWithAuthorization(
    from, to,
    encryptedValueHandle,  // ← bytes32
    inputProof,            // ← bytes
    validAfter, validBefore, nonce,
    signature
  );

  // 2. Awaiting confirmation
  const receipt = await tx.wait();

  // 3. Decrypting result
  const encryptedTransferred = receipt.logs.find(...).args.transferred;
  const decryptedTransferred = await fhevmInstance.decrypt(
    contractAddress,
    encryptedTransferred,
    facilitatorPrivateKey
  );

  // 4. Verify transferred value
  if (decryptedTransferred === 0n) {
    return { success: false, errorReason: "insufficient_balance" };
  }

  return { success: true, transferredAmount: decryptedTransferred };
}
```

### 4. Hono middleware (`apps/hono-server/src/middleware.ts`)

```typescript
export function confidentialPaymentMiddleware(options: MiddlewareOptions) {
  return async function middleware(c: Context, next: () => Promise<void>) {
    // 1. Check X-PAYMENT header
    const payment = c.req.header("X-PAYMENT");
    if (!payment) {
      return c.json({ accepts: [paymentRequirements] }, 402);
    }

    // 2. Verify header
    const verification = await verifyConfidentialPayment(...);
    if (!verification.isValid) {
      return c.json({ error: verification.invalidReason }, 402);
    }

    // 3. Execute business logic
    await next();

    // 4. Settlement
    const settlement = await settleConfidentialPayment(...);

    // 5. Return response
    if (settlement.success) {
      c.res.headers.set("X-PAYMENT-RESPONSE", ...);
    }
  };
}
```


## Common commands

```bash
# 开发
pnpm dev:facilitator  # run Facilitator
pnpm dev:server       # run Hono service
pnpm dev:client       # run client

# build
pnpm build            # build all packages
pnpm typecheck        # type check

# clean
pnpm clean            # delete dist/ 和 node_modules/
```

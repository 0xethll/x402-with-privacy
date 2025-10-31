/**
 * Confidential X402 Facilitator Service
 *
 * Standalone facilitator for verifying and settling confidential payments
 */

import { config } from "dotenv";
import express, { Request, Response } from "express";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  verifyConfidentialPayment,
  settleConfidentialPayment,
  ensureFHEVMInitialized,
  getFHEVMClient,
  type PaymentPayload,
  type PaymentRequirements,
  type FhevmConfig,
} from "@x402-privacy/core";

config();

const app = express();
app.use(express.json());

// Initialize clients
const publicClient = createPublicClient({
  transport: http(process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"),
});

const facilitatorAccount = privateKeyToAccount(
  process.env.FACILITATOR_PRIVATE_KEY! as Hex
);

const walletClient = createWalletClient({
  account: facilitatorAccount,
  transport: http(process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"),
});

const fhevmConfig: FhevmConfig = {
  network: "sepolia",
  rpcUrl: process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
};

console.log(`🔑 Facilitator address: ${facilitatorAccount.address}`);

// Pre-initialize FHEVM client at startup
console.log("\n🚀 Pre-initializing FHEVM client...");
ensureFHEVMInitialized()
  .then(() => getFHEVMClient(fhevmConfig))
  .then(() => {
    console.log("✅ FHEVM client pre-initialized and ready");
    console.log("   First payment request will be fast!\n");
  })
  .catch((error) => {
    console.error("⚠️  Failed to pre-initialize FHEVM:", error);
    console.error("   Payments will still work, but first request will be slower\n");
  });

/**
 * POST /verify
 * Verify a confidential payment
 */
app.post("/verify", async (req: Request, res: Response) => {
  try {
    const {
      paymentPayload,
      paymentRequirements,
    }: {
      paymentPayload: PaymentPayload;
      paymentRequirements: PaymentRequirements;
    } = req.body;

    if (!paymentPayload || !paymentRequirements) {
      return res.status(400).json({
        error: "Missing paymentPayload or paymentRequirements",
      });
    }

    console.log("\n🔍 Verifying payment...");
    console.log(`   From: ${paymentPayload.payload.authorization.from}`);
    console.log(`   To: ${paymentPayload.payload.authorization.to}`);

    const verification = await verifyConfidentialPayment(
      paymentPayload,
      paymentRequirements,
      publicClient
    );

    console.log(`   Result: ${verification.isValid ? "✅ Valid" : "❌ Invalid"}`);
    if (!verification.isValid) {
      console.log(`   Reason: ${verification.invalidReason}`);
    }

    return res.json(verification);
  } catch (error) {
    console.error("❌ Verification error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * POST /settle
 * Settle a confidential payment
 */
app.post("/settle", async (req: Request, res: Response) => {
  try {
    const {
      paymentPayload,
      paymentRequirements,
    }: {
      paymentPayload: PaymentPayload;
      paymentRequirements: PaymentRequirements;
    } = req.body;

    if (!paymentPayload || !paymentRequirements) {
      return res.status(400).json({
        error: "Missing paymentPayload or paymentRequirements",
      });
    }

    console.log("\n💰 Settling payment...");
    console.log(`   From: ${paymentPayload.payload.authorization.from}`);
    console.log(`   To: ${paymentPayload.payload.authorization.to}`);

    const settlement = await settleConfidentialPayment(
      walletClient,
      publicClient,
      paymentPayload,
      paymentRequirements,
      fhevmConfig
    );

    console.log(`   Result: ${settlement.success ? "✅ Success" : "❌ Failed"}`);
    if (settlement.success) {
      console.log(`   Transaction: ${settlement.transaction}`);
      if (settlement.transferredAmount) {
        console.log(`   Transferred: ${settlement.transferredAmount}`);
      }
    } else {
      console.log(`   Reason: ${settlement.errorReason}`);
    }

    return res.json(settlement);
  } catch (error) {
    console.error("❌ Settlement error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

/**
 * GET /supported
 * Get supported payment schemes and networks
 */
app.get("/supported", (req: Request, res: Response) => {
  return res.json({
    kinds: [
      {
        scheme: "exact-confidential",
        network: "sepolia",
      },
    ],
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get("/health", (req: Request, res: Response) => {
  return res.json({
    status: "ok",
    facilitator: facilitatorAccount.address,
  });
});

const PORT = parseInt(process.env.PORT || "3000");

app.listen(PORT, () => {
  console.log(`\n🚀 Facilitator service running on http://localhost:${PORT}`);
  console.log(`\n📡 Endpoints:`);
  console.log(`   POST /verify   - Verify payment`);
  console.log(`   POST /settle   - Settle payment`);
  console.log(`   GET  /supported - Get supported schemes`);
  console.log(`   GET  /health   - Health check\n`);
});

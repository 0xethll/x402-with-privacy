/**
 * Confidential X402 Client Example
 *
 * Demonstrates how to make privacy-preserving payments
 */

import { config } from "dotenv";
import axios from "axios";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import {
  createPaymentHeader,
  ensureFHEVMInitialized,
  type PaymentRequirements
} from "@x402-privacy/core";

config();

const SERVER_URL = process.env.SERVER_URL || "http://localhost:9527";
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const RPC_URL = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

async function fetchCreditScore() {
  console.log("🔒 Fetching confidential credit score with privacy-preserving payment...\n");

  // Pre-initialize FHEVM SDK (only happens once)
  await ensureFHEVMInitialized();

  // Initialize wallet client
  const account = privateKeyToAccount(PRIVATE_KEY as Hex);
  const walletClient = createWalletClient({
    account,
    transport: http(RPC_URL),
  });

  console.log(`👛 Wallet address: ${account.address}`);

  try {
    // Step 1: Initial request without payment
    console.log("\n📡 Step 1: Making initial request to /credit-score...");
    const response1 = await axios.get(`${SERVER_URL}/credit-score`, {
      validateStatus: () => true, // Accept all status codes
    });

    if (response1.status === 402) {
      console.log("💳 Step 2: Payment required for sensitive data access");

      const { accepts } = response1.data;
      const paymentRequirements: PaymentRequirements = accepts[0];

      console.log("\n📋 Payment Requirements:");
      console.log(`   Resource: ${paymentRequirements.description}`);
      console.log(`   Scheme: ${paymentRequirements.scheme}`);
      console.log(`   Network: ${paymentRequirements.network}`);
      console.log(`   Amount: ${paymentRequirements.maxAmountRequired} (${(Number(paymentRequirements.maxAmountRequired) / 1000000).toFixed(2)} ConfidentialUSD)`);
      console.log(`   Pay To: ${paymentRequirements.payTo}`);

      // Step 2: Create confidential payment header
      console.log("\n🔐 Step 3: Creating FHE encrypted payment...");
      console.log("   🔒 Encrypting payment amount with FHE");
      console.log("   🔏 Payment amount is hidden from third parties");
      const paymentHeader = await createPaymentHeader(
        walletClient,
        { paymentRequirements },
        {
          network: "sepolia",
          rpcUrl: RPC_URL,
        }
      );

      console.log("✅ Payment header created (amount encrypted)");

      // Step 3: Retry request with payment
      console.log("\n📡 Step 4: Retrying request with confidential payment...");
      const response2 = await axios.get(`${SERVER_URL}/credit-score`, {
        headers: {
          "X-PAYMENT": paymentHeader,
        },
      });

      if (response2.status === 200) {
        console.log("\n✅ Payment successful! Access granted to sensitive data");
        console.log("\n🔒 Credit Score Report (Confidential):");
        console.log(JSON.stringify(response2.data, null, 2));

        if (response2.headers["x-payment-response"]) {
          console.log("\n💳 Payment Response:");
          console.log(response2.headers["x-payment-response"]);
        }
      } else {
        console.error(`\n❌ Request failed with status: ${response2.status}`);
        console.error(response2.data);
      }
    } else if (response1.status === 200) {
      console.log("\n✅ Request succeeded without payment (no payment required)");
      console.log(response1.data);
    } else {
      console.error(`\n❌ Unexpected status: ${response1.status}`);
      console.error(response1.data);
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("\n❌ Request failed:");
      console.error(`   Status: ${error.response?.status}`);
      console.error(`   Message: ${error.message}`);
      if (error.response?.data) {
        console.error(`   Data:`, error.response.data);
      }
    } else {
      console.error("\n❌ Error:", error);
    }
  }
}

// Run the example
fetchCreditScore()
  .then(() => {
    console.log("\n✨ Done!");
    console.log("\n💡 Privacy Note:");
    console.log("   Your payment amount was encrypted using FHE (Fully Homomorphic Encryption)");
    console.log("   No one can see how much you paid to access your credit score");
    console.log("   This protects your financial privacy!\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });

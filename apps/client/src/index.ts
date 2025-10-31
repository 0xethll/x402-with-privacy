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
import { createPaymentHeader, type PaymentRequirements } from "@x402-privacy/core";

config();

const SERVER_URL = process.env.SERVER_URL || "http://localhost:4021";
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const RPC_URL = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

async function fetchWeatherData() {
  console.log("🌤️  Fetching weather data with confidential payment...\n");

  // Initialize wallet client
  const account = privateKeyToAccount(PRIVATE_KEY as Hex);
  const walletClient = createWalletClient({
    account,
    transport: http(RPC_URL),
  });

  console.log(`👛 Wallet address: ${account.address}`);

  try {
    // Step 1: Initial request without payment
    console.log("\n📡 Step 1: Making initial request...");
    const response1 = await axios.get(`${SERVER_URL}/weather`, {
      validateStatus: () => true, // Accept all status codes
    });

    if (response1.status === 402) {
      console.log("💳 Step 2: Payment required. Creating confidential payment...");

      const { accepts } = response1.data;
      const paymentRequirements: PaymentRequirements = accepts[0];

      console.log("\n📋 Payment Requirements:");
      console.log(`   Scheme: ${paymentRequirements.scheme}`);
      console.log(`   Network: ${paymentRequirements.network}`);
      console.log(`   Amount: ${paymentRequirements.maxAmountRequired}`);
      console.log(`   Pay To: ${paymentRequirements.payTo}`);

      // Step 2: Create confidential payment header
      console.log("\n🔐 Step 3: Creating FHE encrypted payment...");
      const paymentHeader = await createPaymentHeader(
        walletClient,
        { paymentRequirements },
        {
          network: "sepolia",
          rpcUrl: RPC_URL,
        }
      );

      console.log("✅ Payment header created (encrypted)");

      // Step 3: Retry request with payment
      console.log("\n📡 Step 4: Retrying request with payment...");
      const response2 = await axios.get(`${SERVER_URL}/weather`, {
        headers: {
          "X-PAYMENT": paymentHeader,
        },
      });

      if (response2.status === 200) {
        console.log("\n✅ Payment successful!");
        console.log("\n🌤️  Weather Data:");
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
fetchWeatherData()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });

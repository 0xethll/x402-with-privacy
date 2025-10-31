/**
 * Client-side payment header creation for confidential X402
 */

import { type WalletClient, type Address, type Hex, hashTypedData } from "viem";
import { uint8ArrayToHex } from "@fhevmsdk/core";
import type {
  PaymentPayload,
  PaymentRequirements,
  CreatePaymentHeaderOptions,
  FhevmConfig,
} from "@x402-privacy/types";
import { encodePaymentPayload } from "../utils/encoding";
import { getChainId, getFhevmNetwork } from "../utils/network";
import { getFHEVMClient } from "../utils/fhevm";

/**
 * Create encrypted payment header for confidential X402 protocol
 *
 * @param walletClient - Viem wallet client for signing
 * @param options - Payment header creation options
 * @param fhevmConfig - FHE VM configuration
 * @returns Base64 encoded payment header
 */
export async function createPaymentHeader(
  walletClient: WalletClient,
  options: CreatePaymentHeaderOptions,
  fhevmConfig: FhevmConfig
): Promise<string> {
  const { paymentRequirements, x402Version = 1 } = options;

  if (!walletClient.account) {
    throw new Error("Wallet client must have an account");
  }

  // Get or create cached FHEVM client
  const client = await getFHEVMClient(fhevmConfig);

  // Encrypt amount
  const plaintextAmount = BigInt(paymentRequirements.maxAmountRequired);
  const encryptedValue = await client.encrypt.uint64({
    value: plaintextAmount,
    contractAddress: paymentRequirements.asset as Address,
    userAddress: walletClient.account.address,
  });

  // For EIP-712 signature: use the handle (bytes32) directly
  // IMPORTANT: Use FHEVM SDK's uint8ArrayToHex for correct encoding
  const encryptedValueHandle = uint8ArrayToHex(encryptedValue.handle); // bytes32
  const inputProof = uint8ArrayToHex(encryptedValue.proof);

  console.log("\n🔐 Encrypted value details:");
  console.log("   Handle (bytes32):", encryptedValueHandle);
  console.log("   Handle length:", encryptedValueHandle.length);

  // Prepare authorization parameters
  const from = walletClient.account.address;
  const to = paymentRequirements.payTo as Address;

  // Generate random nonce (32 bytes)
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = `0x${Buffer.from(randomBytes).toString("hex")}` as Hex;

  const validAfter = BigInt(Math.floor(Date.now() / 1000) - 600); // 10 minutes before
  const validBefore = BigInt(
    Math.floor(Date.now() / 1000) + paymentRequirements.maxTimeoutSeconds
  );

  // Build EIP-712 signature
  const domain = {
    name: paymentRequirements.extra?.name || "Confidential USD",
    version: paymentRequirements.extra?.version || "1",
    chainId: getChainId(paymentRequirements.network),
    verifyingContract: paymentRequirements.asset as Address,
  } as const;

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "encryptedValueHandle", type: "bytes32" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  } as const;

  const message = {
    from,
    to,
    encryptedValueHandle,
    validAfter,
    validBefore,
    nonce,
  } as const;

  console.log("\n✍️  Signing EIP-712 message...");
  console.log("   Domain:", JSON.stringify(domain, null, 2));
  console.log("   Message:", JSON.stringify({
    from,
    to,
    encryptedValueHandle,
    validAfter: validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
  }, null, 2));

  // Compute and log the digest for debugging
  const digest = hashTypedData({
    domain,
    types,
    primaryType: "TransferWithAuthorization",
    message,
  });

  console.log("   EIP-712 Digest:", digest);

  const signature = await walletClient.signTypedData({
    account: walletClient.account,
    domain,
    types,
    primaryType: "TransferWithAuthorization",
    message,
  });

  console.log("   Signature:", signature);
  console.log("   Signer address:", walletClient.account.address);

  // Build payment payload
  const paymentPayload: PaymentPayload = {
    x402Version,
    scheme: "exact-confidential",
    network: paymentRequirements.network,
    payload: {
      signature,
      authorization: {
        from,
        to,
        encryptedValueHandle,
        inputProof,
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  };

  return encodePaymentPayload(paymentPayload);
}

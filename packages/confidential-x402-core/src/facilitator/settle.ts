/**
 * Facilitator settlement logic for confidential X402
 */

import {
  type WalletClient,
  type PublicClient,
  type Address,
  type Hex,
  parseErc6492Signature,
  getContract,
  parseEventLogs,
} from "viem";
import { initFHEVM, createFHEVMClient } from "@fhevmsdk/core";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  FhevmConfig,
} from "@x402-privacy/types";
import { getFhevmNetwork } from "../utils/network";

const CONFIDENTIAL_USD_ABI = [
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "encryptedValueHandle", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    name: "transferWithAuthorization",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "transferred", type: "bytes32" },
      { indexed: true, name: "nonce", type: "bytes32" },
    ],
    name: "AuthorizationUsed",
    type: "event",
  },
] as const;

/**
 * Settle confidential payment by executing on-chain transfer
 *
 * @param walletClient - Facilitator's wallet client (pays gas)
 * @param publicClient - Public client for reading blockchain state
 * @param payload - Payment payload from client
 * @param requirements - Payment requirements
 * @param fhevmConfig - FHE VM configuration for decryption
 * @returns Settlement response
 */
export async function settleConfidentialPayment(
  walletClient: WalletClient,
  publicClient: PublicClient,
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  fhevmConfig: FhevmConfig
): Promise<SettleResponse> {
  const { authorization, signature } = payload.payload;

  if (!walletClient.account) {
    throw new Error("Wallet client must have an account");
  }

  const contract = getContract({
    address: requirements.asset as Address,
    abi: CONFIDENTIAL_USD_ABI,
    client: { public: publicClient, wallet: walletClient },
  });

  try {
    // Parse ERC-6492 signature if needed
    const { signature: cleanSignature } = parseErc6492Signature(signature as Hex);

    const hash = await contract.write.transferWithAuthorization([
      authorization.from as Address,
      authorization.to as Address,
      authorization.encryptedValueHandle as Hex,
      authorization.inputProof as Hex,
      BigInt(authorization.validAfter),
      BigInt(authorization.validBefore),
      authorization.nonce as Hex,
      cleanSignature,
    ], { account: walletClient.account, chain: walletClient.chain,});

    console.log("Transaction submitted:", hash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== "success") {
      return {
        success: false,
        transaction: hash,
        network: payload.network,
        payer: authorization.from,
        errorReason: "transaction_reverted",
      };
    }

    // Extract transferred amount from event
    const events = parseEventLogs({
      abi: CONFIDENTIAL_USD_ABI,
      logs: receipt.logs,
      eventName: "AuthorizationUsed",
    });

    if (events.length === 0) {
      console.warn("AuthorizationUsed event not found");
      // Transaction succeeded but couldn't verify amount
      return {
        success: true,
        transaction: hash,
        network: payload.network,
        payer: authorization.from,
      };
    }

    const event = events[0];
    const encryptedTransferredHandle = event.args.transferred as Hex;

    // Decrypt transferred amount
    try {
      if (!walletClient.account) {
        throw new Error("Wallet client must have an account for decryption");
      }

      // Initialize FHEVM SDK
      await initFHEVM();

      // Create FHEVM client with RPC provider
      const client = await createFHEVMClient({
        network: fhevmConfig.network,
        provider: fhevmConfig.rpcUrl,
      });

      // Decrypt using wallet client for signing
      const decryptedTransferred = await client.decrypt({
        ciphertextHandle: encryptedTransferredHandle,
        contractAddress: requirements.asset as Address,
        walletClient: walletClient as any, // Type assertion for @fhevmsdk/core compatibility
      });

      console.log("Decrypted transferred amount:", decryptedTransferred);

      // Check if actual transfer succeeded
      if (decryptedTransferred === 0n) {
        return {
          success: false,
          transaction: hash,
          network: payload.network,
          payer: authorization.from,
          errorReason: "insufficient_balance",
        };
      }

      const expectedAmount = BigInt(requirements.maxAmountRequired);
      if (decryptedTransferred < expectedAmount) {
        return {
          success: false,
          transaction: hash,
          network: payload.network,
          payer: authorization.from,
          errorReason: "partial_transfer",
          transferredAmount: decryptedTransferred.toString(),
        };
      }

      // Success!
      return {
        success: true,
        transaction: hash,
        network: payload.network,
        payer: authorization.from,
        transferredAmount: decryptedTransferred.toString(),
      };
    } catch (decryptError) {
      console.error("Failed to decrypt transferred amount:", decryptError);
      // Transaction succeeded but couldn't verify amount
      return {
        success: true,
        transaction: hash,
        network: payload.network,
        payer: authorization.from,
      };
    }
  } catch (error: any) {
    console.error("Settlement failed:", error);

    // Parse error messages
    const errorMessage = error.message || "";

    if (errorMessage.includes("insufficient balance")) {
      return {
        success: false,
        transaction: "",
        network: payload.network,
        payer: authorization.from,
        errorReason: "insufficient_balance",
      };
    }

    if (errorMessage.includes("already used")) {
      return {
        success: false,
        transaction: "",
        network: payload.network,
        payer: authorization.from,
        errorReason: "nonce_already_used",
      };
    }

    if (errorMessage.includes("Invalid signature")) {
      return {
        success: false,
        transaction: "",
        network: payload.network,
        payer: authorization.from,
        errorReason: "invalid_signature",
      };
    }

    return {
      success: false,
      transaction: "",
      network: payload.network,
      payer: authorization.from,
      errorReason: errorMessage || "unknown_error",
    };
  }
}

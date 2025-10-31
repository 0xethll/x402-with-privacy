/**
 * Client-side payment header creation for confidential X402
 */

import { initFHEVM, createFHEVMClient } from "@fhevmsdk/core";
import { type WalletClient, type Address, type Hex, bytesToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type {
  PaymentPayload,
  PaymentRequirements,
  CreatePaymentHeaderOptions,
  FhevmConfig,
} from "@x402-privacy/types";
import { encodePaymentPayload } from "../utils/encoding";
import { getChainId, getFhevmNetwork } from "../utils/network";

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

  // Initialize FHEVM SDK
  await initFHEVM();

  // Create FHEVM client with RPC provider
  const client = await createFHEVMClient({
    network: fhevmConfig.network,
    provider: fhevmConfig.rpcUrl,
  });

  // Encrypt amount
  const plaintextAmount = BigInt(paymentRequirements.maxAmountRequired);
  const { handle, proof } = await client.encrypt.uint64({
    value: plaintextAmount,
    contractAddress: paymentRequirements.asset as Address,
    userAddress: walletClient.account.address,
  });

  const encryptedValueHandle = bytesToHex(handle); // bytes32
  const inputProof = bytesToHex(proof);

  // Prepare authorization parameters
  const from = walletClient.account.address;
  const to = paymentRequirements.payTo as Address;

  // Generate random nonce (32 bytes)
  const randomAccount = privateKeyToAccount(
    `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")}` as Hex
  );
  const nonce = randomAccount.address as Hex; // Use address as random bytes32

  const validAfter = BigInt(Math.floor(Date.now() / 1000) - 600); // 10 minutes before
  const validBefore = BigInt(
    Math.floor(Date.now() / 1000) + paymentRequirements.maxTimeoutSeconds
  );

  // Build EIP-712 signature
  const domain = {
    name: paymentRequirements.extra?.name || "ConfidentialUSD",
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

  const signature = await walletClient.signTypedData({
    account: walletClient.account,
    domain,
    types,
    primaryType: "TransferWithAuthorization",
    message,
  });

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

/**
 * Facilitator verification logic for confidential X402
 */

import {
  type PublicClient,
  type Address,
  type Hex,
  getAddress,
  verifyTypedData,
  getContract,
} from "viem";
import type {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
} from "@x402-privacy/types";
import { getChainId } from "../utils/network";

const CONFIDENTIAL_USD_ABI = [
  {
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    name: "isNonceUsed",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Verify confidential payment signature and authorization
 *
 * Note: Cannot verify encrypted balance or amount
 * These validations happen on-chain during settlement
 *
 * @param payload - Payment payload from client
 * @param requirements - Payment requirements from server
 * @param publicClient - Viem public client for blockchain queries
 * @returns Verification response
 */
export async function verifyConfidentialPayment(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  publicClient: PublicClient
): Promise<VerifyResponse> {
  const { authorization, signature } = payload.payload;

  // Verify scheme
  if (payload.scheme !== "exact-confidential") {
    return {
      isValid: false,
      invalidReason: "unsupported_scheme",
      payer: authorization.from,
    };
  }

  // Verify network
  if (payload.network !== requirements.network) {
    return {
      isValid: false,
      invalidReason: "invalid_network",
      payer: authorization.from,
    };
  }

  // Verify time window
  const now = BigInt(Math.floor(Date.now() / 1000));

  if (BigInt(authorization.validAfter) > now) {
    return {
      isValid: false,
      invalidReason: "authorization_not_yet_valid",
      payer: authorization.from,
    };
  }

  if (BigInt(authorization.validBefore) < now + 6n) {
    return {
      isValid: false,
      invalidReason: "authorization_expired",
      payer: authorization.from,
    };
  }

  // Verify nonce not used
  try {
    const contract = getContract({
      address: requirements.asset as Address,
      abi: CONFIDENTIAL_USD_ABI,
      client: publicClient,
    });

    const isUsed = await contract.read.isNonceUsed([
      authorization.from as Address,
      authorization.nonce as Hex,
    ]);

    if (isUsed) {
      return {
        isValid: false,
        invalidReason: "nonce_already_used",
        payer: authorization.from,
      };
    }
  } catch (error) {
    console.error("Failed to check nonce:", error);
    // Continue verification even if nonce check fails
  }

  // Verify EIP-712 signature
  const domain = {
    name: requirements.extra?.name || "ConfidentialUSD",
    version: requirements.extra?.version || "1",
    chainId: getChainId(requirements.network),
    verifyingContract: requirements.asset as Address,
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
    from: authorization.from as Address,
    to: authorization.to as Address,
    encryptedValueHandle: authorization.encryptedValueHandle as Hex,
    validAfter: BigInt(authorization.validAfter),
    validBefore: BigInt(authorization.validBefore),
    nonce: authorization.nonce as Hex,
  } as const;

  try {
    const isValid = await verifyTypedData({
      address: authorization.from as Address,
      domain,
      types,
      primaryType: "TransferWithAuthorization",
      message,
      signature: signature as Hex,
    });

    if (!isValid) {
      return {
        isValid: false,
        invalidReason: "invalid_signature",
        payer: authorization.from,
      };
    }
  } catch (error) {
    return {
      isValid: false,
      invalidReason: "invalid_signature",
      payer: authorization.from,
    };
  }

  // Verify recipient matches
  if (
    getAddress(authorization.to as Address) !== getAddress(requirements.payTo as Address)
  ) {
    return {
      isValid: false,
      invalidReason: "recipient_mismatch",
      payer: authorization.from,
    };
  }

  // All checks passed
  // Note: Balance and amount checks will happen on-chain
  return {
    isValid: true,
    payer: authorization.from,
  };
}

/**
 * Confidential X402 Protocol Types
 *
 * Type definitions for privacy-preserving X402 payment protocol
 */

// ==================== Network Types ====================

export type Network =
  | "sepolia"
  | "mainnet"
  | "base"
  | "base-sepolia"
  | "polygon"
  | "avalanche";

export type FhevmNetwork = "devnet" | "mainnet";

// ==================== Payment Scheme ====================

export type PaymentScheme = "exact-confidential";

// ==================== Core Protocol Types ====================

/**
 * Authorization parameters for encrypted transfer
 */
export interface Authorization {
  from: string;
  to: string;
  encryptedValueHandle: string;  // bytes32 FHE handle
  inputProof: string;             // bytes ZK proof
  validAfter: string;             // Unix timestamp
  validBefore: string;            // Unix timestamp
  nonce: string;                  // bytes32 random value
}

/**
 * Payment payload structure
 */
export interface PaymentPayload {
  x402Version: number;
  scheme: PaymentScheme;
  network: Network;
  payload: {
    signature: string;
    authorization: Authorization;
  };
}

/**
 * Payment requirements from server
 */
export interface PaymentRequirements {
  scheme: PaymentScheme;
  network: Network;
  maxAmountRequired: string;      // Amount in smallest unit (e.g., 1000 = 0.001 token)
  resource: string;                // URL of the resource
  description: string;
  mimeType: string;
  payTo: string;                   // Recipient address
  maxTimeoutSeconds: number;
  asset: string;                   // ConfidentialUSD contract address
  extra?: {
    name: string;                  // Token name for EIP-712
    version: string;               // EIP-712 version
  };
}

/**
 * 402 Payment Required Response
 */
export interface PaymentRequiredResponse {
  error: string;
  accepts: PaymentRequirements[];
  x402Version: number;
}

// ==================== Verification & Settlement ====================

/**
 * Verification response from facilitator
 */
export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer: string;
}

/**
 * Settlement response from facilitator
 */
export interface SettleResponse {
  success: boolean;
  transaction: string;
  network: Network;
  payer: string;
  errorReason?: string;
  transferredAmount?: string;     // Optional: actual transferred amount after decryption
}

/**
 * Payment response header (X-PAYMENT-RESPONSE)
 */
export interface PaymentResponse {
  success: boolean;
  transaction: string;
  network: Network;
  payer: string;
}

// ==================== Facilitator Config ====================

/**
 * Facilitator configuration
 */
export interface FacilitatorConfig {
  url?: string;                   // Facilitator URL (default: x402.org/facilitator)
  createAuthHeaders?: () => Promise<{
    verify: Record<string, string>;
    settle: Record<string, string>;
  }>;
}

// ==================== Route Configuration ====================

/**
 * Route-specific payment configuration
 */
export interface RouteConfig {
  price: string | number;         // Price in USD or token units
  network: Network;
  config?: {
    description?: string;
    mimeType?: string;
    maxTimeoutSeconds?: number;
    customPaywallHtml?: string;
    errorMessages?: {
      paymentRequired?: string;
      invalidPayment?: string;
      verificationFailed?: string;
      settlementFailed?: string;
    };
  };
}

/**
 * Routes configuration for middleware
 */
export type RoutesConfig = Record<string, RouteConfig>;

// ==================== FHE Specific Types ====================

/**
 * FHE encrypted input structure
 */
export interface EncryptedInput {
  handles: string[];              // Array of bytes32 handles
  inputProof: Uint8Array;         // ZK proof bytes
}

/**
 * FHE instance configuration
 */
export interface FhevmConfig {
  network: FhevmNetwork;
  gatewayUrl: string;
  contractAddress?: string;
}

// ==================== Client Types ====================

/**
 * X402 Client configuration
 */
export interface X402ClientConfig {
  network: Network;
  fhevmNetwork: FhevmNetwork;
  privateKey: string;
  rpcUrl?: string;
  gatewayUrl: string;
}

/**
 * Create payment header options
 */
export interface CreatePaymentHeaderOptions {
  paymentRequirements: PaymentRequirements;
  x402Version?: number;
}

// ==================== Server Types ====================

/**
 * Middleware options for Hono server
 */
export interface MiddlewareOptions {
  payTo: string;
  routes: RoutesConfig;
  facilitator?: FacilitatorConfig;
  contractAddress: string;        // ConfidentialUSD contract address
}

// ==================== Error Types ====================

/**
 * X402 Error codes
 */
export enum X402ErrorCode {
  PAYMENT_REQUIRED = "payment_required",
  INVALID_SIGNATURE = "invalid_signature",
  NONCE_ALREADY_USED = "nonce_already_used",
  AUTHORIZATION_EXPIRED = "authorization_expired",
  AUTHORIZATION_NOT_YET_VALID = "authorization_not_yet_valid",
  INSUFFICIENT_BALANCE = "insufficient_balance",
  PARTIAL_TRANSFER = "partial_transfer",
  VERIFICATION_FAILED = "verification_failed",
  SETTLEMENT_FAILED = "settlement_failed",
  UNSUPPORTED_SCHEME = "unsupported_scheme",
  INVALID_NETWORK = "invalid_network",
}

/**
 * X402 Error class
 */
export class X402Error extends Error {
  constructor(
    public code: X402ErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "X402Error";
  }
}

// ==================== Utility Types ====================

/**
 * Helper type for async function results
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Base64 encoded string
 */
export type Base64String = string;

/**
 * Hex string (0x...)
 */
export type HexString = `0x${string}`;

/**
 * Ethereum address
 */
export type Address = HexString;

/**
 * Bytes32 hex string
 */
export type Bytes32 = HexString;

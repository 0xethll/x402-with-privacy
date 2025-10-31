/**
 * Confidential X402 Core Library
 *
 * Core functionality for privacy-preserving X402 payment protocol
 */

// Re-export types
export * from "@x402-privacy/types";

// Client exports
export { createPaymentHeader } from "./client/createPaymentHeader";

// Facilitator exports
export { verifyConfidentialPayment } from "./facilitator/verify";
export { settleConfidentialPayment } from "./facilitator/settle";

// Utilities
export { encodePaymentPayload, decodePaymentPayload } from "./utils/encoding";
export { getChainId, getFhevmNetwork } from "./utils/network";

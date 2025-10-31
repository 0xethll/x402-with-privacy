/**
 * Encoding utilities for X402 protocol
 */

import type { PaymentPayload, Base64String } from "@x402-privacy/types";

/**
 * Encode payment payload to Base64 string
 */
export function encodePaymentPayload(payload: PaymentPayload): Base64String {
  const json = JSON.stringify(payload);
  return Buffer.from(json, "utf-8").toString("base64");
}

/**
 * Decode payment payload from Base64 string
 */
export function decodePaymentPayload(encoded: Base64String): PaymentPayload {
  const json = Buffer.from(encoded, "base64").toString("utf-8");
  return JSON.parse(json) as PaymentPayload;
}

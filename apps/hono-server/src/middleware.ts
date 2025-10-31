/**
 * Confidential X402 middleware for Hono
 */

import { Context } from "hono";
import {
  decodePaymentPayload,
  encodePaymentPayload,
  type MiddlewareOptions,
  type PaymentRequirements,
  type VerifyResponse,
  type SettleResponse,
} from "@x402-privacy/core";

/**
 * Create confidential payment middleware for Hono
 */
export function confidentialPaymentMiddleware(options: MiddlewareOptions) {
  const { payTo, routes, facilitator, contractAddress } = options;

  if (!facilitator?.url) {
    throw new Error("Facilitator URL is required in middleware options");
  }

  const facilitatorUrl = facilitator.url;

  return async function middleware(c: Context, next: () => Promise<void>) {
    const method = c.req.method.toUpperCase();
    const path = new URL(c.req.url).pathname;

    // Find matching route
    const matchingRoute = Object.entries(routes).find(([pattern]) => {
      const regex = new RegExp(
        `^${pattern.replace(/\*/g, ".*").replace(/\//g, "\\/")}$`
      );
      return regex.test(path);
    });

    if (!matchingRoute) {
      return next();
    }

    const [, routeConfig] = matchingRoute;

    // Build payment requirements
    const paymentRequirements: PaymentRequirements = {
      scheme: "exact-confidential",
      network: routeConfig.network,
      maxAmountRequired: routeConfig.price.toString(),
      resource: c.req.url,
      description: routeConfig.config?.description || "Access to resource",
      mimeType: routeConfig.config?.mimeType || "application/json",
      payTo,
      maxTimeoutSeconds: routeConfig.config?.maxTimeoutSeconds || 300,
      asset: contractAddress,
      extra: {
        name: "ConfidentialUSD",
        version: "1",
      },
    };

    const payment = c.req.header("X-PAYMENT");

    // No payment header: return 402
    if (!payment) {
      return c.json(
        {
          error: routeConfig.config?.errorMessages?.paymentRequired ||
            "Payment required",
          accepts: [paymentRequirements],
          x402Version: 1,
        },
        402
      );
    }

    // Decode payment payload
    let decodedPayment;
    try {
      decodedPayment = decodePaymentPayload(payment);
    } catch (error) {
      return c.json(
        {
          error: routeConfig.config?.errorMessages?.invalidPayment ||
            "Invalid payment header",
          accepts: [paymentRequirements],
        },
        402
      );
    }

    // Verify payment via Facilitator service
    let verification: VerifyResponse;
    try {
      const verifyResponse = await fetch(`${facilitatorUrl}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentPayload: decodedPayment,
          paymentRequirements,
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error(`Facilitator verify failed: ${verifyResponse.status}`);
      }

      verification = await verifyResponse.json();
    } catch (error) {
      console.error("Failed to verify payment:", error);
      return c.json(
        {
          error: "Failed to verify payment with facilitator",
          accepts: [paymentRequirements],
        },
        402
      );
    }

    if (!verification.isValid) {
      return c.json(
        {
          error: routeConfig.config?.errorMessages?.verificationFailed ||
            verification.invalidReason,
          accepts: [paymentRequirements],
          payer: verification.payer,
        },
        402
      );
    }

    // Execute business logic
    await next();

    let res = c.res;

    // If business logic returned error, don't settle
    if (res.status >= 400) {
      return;
    }

    c.res = undefined;

    // Settle payment via Facilitator service
    try {
      const settleResponse = await fetch(`${facilitatorUrl}/settle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          paymentPayload: decodedPayment,
          paymentRequirements,
        }),
      });

      if (!settleResponse.ok) {
        throw new Error(`Facilitator settle failed: ${settleResponse.status}`);
      }

      const settlement: SettleResponse = await settleResponse.json();

      if (settlement.success) {
        const responseHeader = encodePaymentPayload({
          ...decodedPayment,
          payload: {
            ...decodedPayment.payload,
            authorization: {
              ...decodedPayment.payload.authorization,
            },
          },
        } as any);

        res.headers.set("X-PAYMENT-RESPONSE", responseHeader);
      } else {
        throw new Error(settlement.errorReason || "Settlement failed");
      }
    } catch (error) {
      console.error("Failed to settle payment:", error);
      res = c.json(
        {
          error: routeConfig.config?.errorMessages?.settlementFailed ||
            (error instanceof Error ? error.message : "Settlement failed"),
          accepts: [paymentRequirements],
        },
        402
      );
    }

    c.res = res;
  };
}

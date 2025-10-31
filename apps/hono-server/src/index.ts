/**
 * Confidential X402 Hono Server
 *
 * Example server with privacy-preserving payment middleware
 */

import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { confidentialPaymentMiddleware } from "./middleware";

config();

const app = new Hono();

// Apply confidential payment middleware
app.use(
  confidentialPaymentMiddleware({
    payTo: process.env.PAY_TO_ADDRESS!,
    contractAddress: process.env.CONFIDENTIAL_USD_ADDRESS!,
    routes: {
      "/weather": {
        price: "1000", // 0.001 ConfidentialUSD (6 decimals)
        network: "sepolia",
        config: {
          description: "Access to weather data",
          mimeType: "application/json",
          maxTimeoutSeconds: 300,
        },
      },
    },
    facilitator: {
      url: process.env.FACILITATOR_URL,
    },
  })
);

// Protected routes
app.get("/weather", (c) => {
  return c.json({
    report: {
      weather: "sunny",
      temperature: 70,
      humidity: 65,
      windSpeed: 10,
    },
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

const port = parseInt(process.env.PORT || "4021");

serve({
  fetch: app.fetch,
  port,
});

console.log(`🚀 Confidential X402 server running on http://localhost:${port}`);
console.log(`📊 Protected endpoint: /weather`);

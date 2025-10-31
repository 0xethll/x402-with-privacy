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
      "/credit-score": {
        price: "500000", // 0.5 ConfidentialUSD (6 decimals) - Higher price for sensitive data
        network: "sepolia",
        config: {
          description: "Access to confidential credit score report",
          mimeType: "application/json",
          maxTimeoutSeconds: 300,
        },
      },
      "/medical-records": {
        price: "1000000", // 1.0 ConfidentialUSD - Premium sensitive data
        network: "sepolia",
        config: {
          description: "Access to confidential medical records",
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

// Protected routes - Sensitive data APIs

/**
 * GET /credit-score
 * Returns confidential credit score information
 * Payment required: 0.5 ConfidentialUSD
 *
 * Privacy benefit: Payment amount is encrypted, third parties cannot see
 * how much you paid to access your credit score
 */
app.get("/credit-score", (c) => {
  const userId = c.req.query("userId") || "anonymous";

  return c.json({
    userId,
    creditScore: 750,
    scoreRange: "670-850",
    rating: "Good",
    factors: {
      paymentHistory: "Excellent",
      creditUtilization: "28%",
      creditAge: "7 years",
      accountMix: "Diverse",
      recentInquiries: 2,
    },
    recommendations: [
      "Keep credit utilization below 30%",
      "Continue making on-time payments",
      "Avoid opening new credit accounts in the next 6 months",
    ],
    lastUpdated: new Date().toISOString(),
    disclaimer: "This is confidential financial information. Payment was made privately using FHE encryption.",
  });
});

/**
 * GET /medical-records
 * Returns confidential medical records
 * Payment required: 1.0 ConfidentialUSD
 *
 * Privacy benefit: Medical data access is paid for confidentially,
 * preventing third parties from knowing what medical information you're accessing
 */
app.get("/medical-records", (c) => {
  const patientId = c.req.query("patientId") || "anonymous";

  return c.json({
    patientId,
    records: [
      {
        date: "2024-10-15",
        type: "Annual Checkup",
        diagnosis: "Healthy",
        notes: "All vitals normal. Blood pressure: 120/80",
      },
      {
        date: "2024-08-22",
        type: "Lab Results",
        diagnosis: "Vitamin D Deficiency",
        prescription: "Vitamin D supplement - 2000 IU daily",
      },
      {
        date: "2024-03-10",
        type: "Vaccination",
        diagnosis: "Preventive Care",
        notes: "Annual flu vaccine administered",
      },
    ],
    allergies: ["Penicillin"],
    currentMedications: ["Vitamin D 2000 IU"],
    bloodType: "O+",
    emergencyContact: {
      name: "Emergency Contact",
      phone: "+1-555-0100",
    },
    lastUpdated: new Date().toISOString(),
    disclaimer: "This is protected health information (PHI). Payment was made privately using FHE encryption to protect your privacy.",
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

console.log(`\n🚀 Confidential X402 server running on http://localhost:${port}`);
console.log(`\n🔒 Protected Endpoints (Privacy-Preserving Payments):`);
console.log(`   GET /credit-score      - 0.5 ConfidentialUSD`);
console.log(`   GET /medical-records   - 1.0 ConfidentialUSD`);
console.log(`\n💡 Privacy benefit: Payment amounts are encrypted using FHE`);
console.log(`   Third parties cannot see how much you paid for sensitive data\n`);

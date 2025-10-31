/**
 * FHEVM client singleton manager
 * Prevents redundant initialization of FHEVM instances
 */

import { initFHEVM, createFHEVMClient } from "@fhevmsdk/core";
import type { FhevmConfig } from "@x402-privacy/types";

/**
 * Global FHEVM client cache
 * Key: `${network}-${rpcUrl}`
 */
const clientCache = new Map<string, any>();

/**
 * Track initialization status
 */
let isInitialized = false;

/**
 * Initialize FHEVM SDK once globally
 */
export async function ensureFHEVMInitialized(): Promise<void> {
  if (!isInitialized) {
    console.log("🔧 Initializing FHEVM SDK...");
    await initFHEVM();
    isInitialized = true;
    console.log("✅ FHEVM SDK initialized");
  }
}

/**
 * Get or create FHEVM client with caching
 *
 * @param config - FHEVM configuration
 * @returns Cached or newly created FHEVM client
 */
export async function getFHEVMClient(config: FhevmConfig): Promise<any> {
  // Ensure SDK is initialized first
  await ensureFHEVMInitialized();

  // Create cache key
  const { network, rpcUrl } = config;
  const cacheKey = `${network}-${rpcUrl}`;

  // Return cached client if exists
  if (clientCache.has(cacheKey)) {
    console.log(`♻️  Using cached FHEVM client for ${network}`);
    return clientCache.get(cacheKey);
  }

  // Create new client
  console.log(`🔧 Creating new FHEVM client for ${network}...`);
  const client = await createFHEVMClient({
    network,
    provider: rpcUrl,
  });

  // Cache the client
  clientCache.set(cacheKey, client);
  console.log(`✅ FHEVM client ready and cached`);

  return client;
}

/**
 * Clear all cached clients (useful for testing or cleanup)
 */
export function clearFHEVMCache(): void {
  clientCache.clear();
  isInitialized = false;
}

/**
 * Get cache statistics (useful for debugging)
 */
export function getFHEVMCacheStats() {
  return {
    isInitialized,
    cachedClients: clientCache.size,
    cacheKeys: Array.from(clientCache.keys()),
  };
}

/**
 * Network utilities for X402 protocol
 */

import type { Network, FhevmNetwork } from "@x402-privacy/types";

const CHAIN_IDS: Record<Network, number> = {
  mainnet: 1,
  sepolia: 11155111,
  base: 8453,
  "base-sepolia": 84532,
  polygon: 137,
  avalanche: 43114,
};

const FHEVM_NETWORKS: Record<Network, FhevmNetwork> = {
  sepolia: "devnet",
  mainnet: "mainnet",
  base: "mainnet",
  "base-sepolia": "devnet",
  polygon: "mainnet",
  avalanche: "mainnet",
};

/**
 * Get chain ID for network
 */
export function getChainId(network: Network): number {
  const chainId = CHAIN_IDS[network];
  if (!chainId) {
    throw new Error(`Unknown network: ${network}`);
  }
  return chainId;
}

/**
 * Get fhEVM network for blockchain network
 */
export function getFhevmNetwork(network: Network): FhevmNetwork {
  const fhevmNetwork = FHEVM_NETWORKS[network];
  if (!fhevmNetwork) {
    throw new Error(`Unknown network: ${network}`);
  }
  return fhevmNetwork;
}

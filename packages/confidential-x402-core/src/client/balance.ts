/**
 * Balance checking and minting utilities for confidential tokens
 */

import { type WalletClient, type PublicClient, type Address, type Hex, getContract } from "viem";
import { uint8ArrayToHex } from "@fhevmsdk/core";
import { getFHEVMClient } from "../utils/fhevm";
import type { FhevmConfig } from "@x402-privacy/types";

const CONFIDENTIAL_TOKEN_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "confidentialBalanceOf",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const MAX_MINT_AMOUNT = 10_000_000n;

/**
 * Get decrypted balance for an account
 *
 * @param walletClient - Wallet client for signing decryption request
 * @param publicClient - Public client for reading contract
 * @param tokenAddress - ConfidentialUSD contract address
 * @param account - Account address to check
 * @param fhevmConfig - FHE VM configuration
 * @returns Decrypted balance
 */
export async function getConfidentialBalance(
  walletClient: WalletClient,
  publicClient: PublicClient,
  tokenAddress: Address,
  account: Address,
  fhevmConfig: FhevmConfig
): Promise<bigint> {
  const contract = getContract({
    address: tokenAddress,
    abi: CONFIDENTIAL_TOKEN_ABI,
    client: publicClient,
  });

  // Read encrypted balance
  const encryptedBalance = await contract.read.confidentialBalanceOf([account]) as Hex;

  // Handle zero balance (no encryption)
  if (encryptedBalance === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    return 0n;
  }

  // Decrypt balance
  const client = await getFHEVMClient(fhevmConfig);
  const balance = await client.decrypt({
    ciphertextHandle: encryptedBalance,
    contractAddress: tokenAddress,
    walletClient: walletClient as any,
  });

  return balance;
}

/**
 * Mint confidential tokens
 *
 * @param walletClient - Wallet client for signing
 * @param publicClient - Public client for transaction
 * @param tokenAddress - ConfidentialUSD contract address
 * @param to - Recipient address
 * @param amount - Amount to mint (will be capped at MAX_MINT_AMOUNT)
 * @param fhevmConfig - FHE VM configuration
 * @returns Transaction hash
 */
export async function mintConfidentialTokens(
  walletClient: WalletClient,
  publicClient: PublicClient,
  tokenAddress: Address,
  to: Address,
  amount: bigint,
  fhevmConfig: FhevmConfig
): Promise<Hex> {
  if (!walletClient.account) {
    throw new Error("Wallet client must have an account");
  }

  // Cap amount at MAX_MINT_AMOUNT
  const mintAmount = amount > MAX_MINT_AMOUNT ? MAX_MINT_AMOUNT : amount;

  // Encrypt amount
  const client = await getFHEVMClient(fhevmConfig);
  const { handle, proof } = await client.encrypt.uint64({
    value: mintAmount,
    contractAddress: tokenAddress,
    userAddress: walletClient.account.address,
  });

  const encryptedHandle = uint8ArrayToHex(handle);
  const inputProof = uint8ArrayToHex(proof);

  // Call mint function
  const contract = getContract({
    address: tokenAddress,
    abi: CONFIDENTIAL_TOKEN_ABI,
    client: { public: publicClient, wallet: walletClient },
  });

  const hash = await contract.write.mint([to, encryptedHandle as Hex, inputProof as Hex], {
    account: walletClient.account,
    chain: walletClient.chain,
  });

  console.log(`💰 Minting ${mintAmount} tokens to ${to}`);
  console.log(`   Transaction: ${hash}`);

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error("Mint transaction failed");
  }

  console.log(`✅ Mint successful`);

  return hash;
}

/**
 * Ensure sufficient balance, mint if needed
 *
 * @param walletClient - Wallet client
 * @param publicClient - Public client
 * @param tokenAddress - ConfidentialUSD contract address
 * @param account - Account to check/mint for
 * @param requiredAmount - Required balance amount
 * @param fhevmConfig - FHE VM configuration
 * @returns True if balance is sufficient (after minting if needed)
 */
export async function ensureSufficientBalance(
  walletClient: WalletClient,
  publicClient: PublicClient,
  tokenAddress: Address,
  account: Address,
  requiredAmount: bigint,
  fhevmConfig: FhevmConfig
): Promise<boolean> {
  console.log(`\n💰 Checking balance for ${account}...`);

  // Get current balance
  const balance = await getConfidentialBalance(
    walletClient,
    publicClient,
    tokenAddress,
    account,
    fhevmConfig
  );

  console.log(`   Current balance: ${balance}`);
  console.log(`   Required: ${requiredAmount}`);

  // Check if sufficient
  if (balance >= requiredAmount) {
    console.log(`✅ Sufficient balance\n`);
    return true;
  }

  console.log(`🔨 Minting ${MAX_MINT_AMOUNT} tokens...`);

  // Mint tokens
  try {
    await mintConfidentialTokens(
      walletClient,
      publicClient,
      tokenAddress,
      account,
      MAX_MINT_AMOUNT,
      fhevmConfig
    );

    // Verify new balance
    const newBalance = await getConfidentialBalance(
      walletClient,
      publicClient,
      tokenAddress,
      account,
      fhevmConfig
    );

    console.log(`💰 New balance: ${newBalance}\n`);

    return newBalance >= requiredAmount;
  } catch (error) {
    console.error(`❌ Failed to mint tokens:`, error);
    return false;
  }
}

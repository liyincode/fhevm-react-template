import { type ChainDefinition, type FhevmConfig, createBrowserFhevmConfig } from "@liyincode/fhevm-sdk/core";

const HARDHAT_CHAIN_ID = 31337;
const HARDHAT_RPC_URL = process.env.NEXT_PUBLIC_HARDHAT_RPC_URL ?? "http://localhost:8545";

const CHAINS: ChainDefinition[] = [
  {
    id: 11155111,
    name: "Sepolia",
    relayer: {
      acl: "0x687820221192C5B662b25367F70076A37bc79b6c",
      kms: "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC",
      inputVerifier: "0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4",
    },
    metadata: {
      relayerConfig: {
        relayerUrl: "https://relayer.testnet.zama.cloud",
        network: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://eth-sepolia.public.blastapi.io",
        gatewayChainId: 55815,
        verifyingContractAddressDecryption: "0xb6E160B1ff80D67Bfe90A85eE06Ce0A2613607D1",
        verifyingContractAddressInputVerification: "0x7048C39f048125eDa9d678AEbaDfB22F7900a29F",
      },
    },
  }
];

const MOCK_CHAINS: Record<number, string> = {
  [HARDHAT_CHAIN_ID]: HARDHAT_RPC_URL,
};

export const browserFhevmConfig = (process.env.NEXT_PUBLIC_ENABLE_LOCALCHAIN === "true"
  ? createBrowserFhevmConfig({ chains: CHAINS, mockChains: MOCK_CHAINS })
  : createBrowserFhevmConfig({
      chains: CHAINS.filter(chain => chain.id !== HARDHAT_CHAIN_ID),
      mockChains: {},
    }));

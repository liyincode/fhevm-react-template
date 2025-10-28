import { type ChainDefinition, type FhevmConfig, createBrowserFhevmConfig } from "@liyincode/fhevm-sdk/core";

const HARDHAT_CHAIN_ID = 31337;
const HARDHAT_RPC_URL = process.env.NEXT_PUBLIC_HARDHAT_RPC_URL ?? "http://localhost:8545";

const CHAINS: ChainDefinition[] = [
  {
    id: HARDHAT_CHAIN_ID,
    name: "Hardhat Localhost",
    rpcUrl: HARDHAT_RPC_URL,
    allowMock: true,
  },
  {
    id: 11155111,
    name: "Sepolia",
  },
];

const MOCK_CHAINS: Record<number, string> = {
  [HARDHAT_CHAIN_ID]: HARDHAT_RPC_URL,
};

export const browserFhevmConfig: FhevmConfig = createBrowserFhevmConfig({
  chains: CHAINS,
  mockChains: MOCK_CHAINS,
});

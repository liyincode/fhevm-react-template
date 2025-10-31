# @liyincode/fhevm-sdk

[![npm version](https://img.shields.io/npm/v/@liyincode/fhevm-sdk.svg)](https://www.npmjs.com/package/@liyincode/fhevm-sdk)

A framework-agnostic front-end SDK for Zama's FHEVM. It wraps the [Relayer SDK](https://docs.zama.ai/protocol/relayer-sdk-guides) so you can bootstrap encrypted dApps across browsers, React apps, and Node environments with one toolkit.

> Requires Node.js 18+ and pnpm 8+. The SDK provides multiple entry points: `core` (platform-agnostic APIs), `react` (React hooks), and `node` (Node.js utilities).

---

## Features

- **Core primitives** – chain definitions, relayer/storage adapters, FHEVM instances
- **React** – wagmi-style hooks (`useFhevmInstance`, `useEncryptedInput`, `useUserDecrypt`)
- **Node.js** – file-based caching and ready-made clients for scripts/services
- **Example** – complete Node.js demo in `examples/node/`

---

## Installation

Install the SDK plus core peer dependencies:

```bash
pnpm add @liyincode/fhevm-sdk @zama-fhe/relayer-sdk ethers
```

Then ensure the runtime you plan to target is available (most projects already have these):

- React apps: include `react@^18` or `^19`
- Node scripts: no extra packages, just an RPC + relayer endpoint

---

## React Quick Start

> Requires `react@^18` or `^19`

1. **Configure chains**

   ```ts
   import { createBrowserFhevmConfig, type ChainDefinition } from "@liyincode/fhevm-sdk/core";

   const CHAINS: ChainDefinition[] = [
     {
       id: 11155111,
       name: "Sepolia",
     },
   ];

   export const browserConfig = createBrowserFhevmConfig({
     chains: CHAINS,
   });
   ```

   Sepolia uses default relayer configuration automatically.

   **For local development**: Add a mock chain for Hardhat/Anvil:

   ```ts
   const CHAINS: ChainDefinition[] = [
     {
       id: 31337,
       name: "Hardhat Localhost",
       rpcUrl: "http://localhost:8545",
       allowMock: true,
     },
     {
       id: 11155111,
       name: "Sepolia",
     },
   ];

   export const browserConfig = createBrowserFhevmConfig({
     chains: CHAINS,
     mockChains: { 31337: "http://localhost:8545" },
   });
   ```

   **For custom relayers**: Add `relayer` addresses and `metadata.relayerConfig` to your chain definition:

   ```ts
   {
     id: 11155111,
     name: "Sepolia",
     relayer: {
       acl: "0x687820221192C5B662b25367F70076A37bc79b6c" as `0x${string}`,
       kms: "0x136458D183671cde5F1FD23b10DbE0583222cb81" as `0x${string}`,
       inputVerifier: "0xbc918B87834d00c6D8a34f1f7aa99C2371f49a67" as `0x${string}`,
     },
     metadata: {
       relayerConfig: {
         relayerUrl: "https://relayer.testnet.zama.cloud",
         network: "https://eth-sepolia.public.blastapi.io",
         gatewayChainId: 55815,
         verifyingContractAddressDecryption: "0xb6E1c3f5ee638916f89a84024BF13e3a0cfd173E",
         verifyingContractAddressInputVerification: "0x704892aBd75C4f38D9e82C2683E7A5252BBF9b66",
       },
     },
   }
   ```

2. **Wrap your app**

   ```tsx
   import { useState } from "react";
   import { FhevmProvider } from "@liyincode/fhevm-sdk/react";
   import { GenericStringInMemoryStorage } from "@liyincode/fhevm-sdk/storage";
   import { browserConfig } from "./fhevmConfig";

   export function Providers({ children }: { children: React.ReactNode }) {
     const [signatureStorage] = useState(() => new GenericStringInMemoryStorage());
     return (
       <FhevmProvider config={browserConfig} storageOverrides={{ signatureStorage }}>
         {children}
       </FhevmProvider>
     );
   }
   ```

3. **Use hooks**

   ```tsx
   import { useFhevmInstance, useEncryptedInput, useUserDecrypt, useSignatureStorage } from "@liyincode/fhevm-sdk/react";

   // Get FHEVM instance
   const { instance } = useFhevmInstance({ chainId: 11155111 });
   const signatureStorage = useSignatureStorage();

   // Decrypt encrypted value
   const { decrypt, data } = useUserDecrypt({
     instance,
     signer: ethersSigner,
     storage: signatureStorage,
     requests: [{ handle: "0x...", contractAddress: "0x..." }],
   });
   console.log("Decrypted:", data["0x..."]);

   // Encrypt input
   const { encrypt } = useEncryptedInput({
     instance,
     signer: ethersSigner,
     contractAddress: "0x...",
   });
   const payload = await encrypt((b) => b.add32(1));
   await contract.increment(payload.handles[0], payload.inputProof);
   ```

   **Available hooks:**
   - `useFhevmInstance()` – get FHEVM instance
   - `useSignatureStorage()` – access signature cache
   - `useUserDecrypt()` – decrypt encrypted handles
   - `useEncryptedInput()` – encrypt values for transactions


## Node Quick Start

1. **Setup environment variables**

   Create a `.env` file:

   ```bash
   # Required
   RELAYER_URL=https://relayer.testnet.zama.cloud
   RPC_URL=https://eth-sepolia.public.blastapi.io
   CONTRACT_ADDRESS=0xYourFheCounterAddress
   PRIVATE_KEY=0xYourPrivateKey
   ```

2. **Create a client and use it**

   ```ts
   import { createNodeFhevmClient, createNodeRelayerAdapter } from "@liyincode/fhevm-sdk/node";
   import { encryptInput, userDecrypt } from "@liyincode/fhevm-sdk/core";
   import { GenericStringInMemoryStorage } from "@liyincode/fhevm-sdk/storage";
   import { JsonRpcProvider, Wallet, Contract } from "ethers";

   // Create client
   const client = createNodeFhevmClient({
     chains: [{ id: 11155111, name: "Sepolia" }],
     directory: "./.fhevm-cache",
     relayerClient: createNodeRelayerAdapter({
       relayerUrl: process.env.RELAYER_URL!,
       rpcUrl: process.env.RPC_URL!,
     }),
   });

   const instance = await client.createInstance({ 
     provider: process.env.RPC_URL!, 
     chainId: 11155111 
   });

   // Setup wallet and contract
   const provider = new JsonRpcProvider(process.env.RPC_URL!);
   const wallet = new Wallet(process.env.PRIVATE_KEY!, provider);
   const contract = new Contract(process.env.CONTRACT_ADDRESS!, ABI, provider);

   // Decrypt encrypted counter value
   const signatureStorage = new GenericStringInMemoryStorage();
   const handle = await contract.getCount();
   const { result } = await userDecrypt({
     instance,
     signer: wallet,
     requests: [{ handle, contractAddress: contract.target as `0x${string}` }],
     storage: signatureStorage,
   });
   console.log("Counter:", result[handle]);

   // Encrypt input and submit transaction
   const payload = await encryptInput({
     instance,
     contractAddress: contract.target as `0x${string}`,
     userAddress: await wallet.getAddress() as `0x${string}`,
     build: (b) => b.add32(1),
   });
   await contract.connect(wallet).increment(payload.handles[0], payload.inputProof);
   ```

   Full example with error handling: [`examples/node/basic.ts`](./examples/node/basic.ts)

---

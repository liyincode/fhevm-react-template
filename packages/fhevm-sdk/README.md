# @liyincode/fhevm-sdk

Framework-agnostic SDK for working with Zama FHEVM across web and node runtimes. Integrates relayer initialization, encryption/decryption workflows, and platform adapters for React, Vue, and Node.js.

> ⚠️ **This is a fork** of the original FHEVM SDK project with modifications and enhancements.

## Features

- **Core Module (`@liyincode/fhevm-sdk/core`)** - Environment-agnostic relayer configuration, instance management, and encryption/decryption utilities for any TypeScript project.
- **React Adapter (`@liyincode/fhevm-sdk/react`)** - Provides `FhevmProvider` and wagmi-style hooks (`useFhevmInstance`, `useEncryptedInput`, `useUserDecrypt`, etc.).
- **Vue Adapter (`@liyincode/fhevm-sdk/vue`)** - Offers `createFhevmVuePlugin` and composables (`useFhevmInstance`, `useEncryptedInput`, `useUserDecrypt`).
- **Node Utilities (`@liyincode/fhevm-sdk/node`)** - File-based public key storage and `createNodeFhevmClient` factory for backend scripts and services.

> Requires **Node.js 18+** and **pnpm 8+**. Ensure you have configured RPC and relayer endpoints according to the official Zama FHEVM documentation.

## Installation

```bash
# Install SDK with required dependencies
pnpm add @liyincode/fhevm-sdk @zama-fhe/relayer-sdk ethers

# For React projects
pnpm add react

# For Vue projects
pnpm add vue@^3.4

# Node.js environment works out of the box
```

## Quick Start

### Core Module

```ts
import {
  createFhevmConfig,
  createFhevmClient,
  createBrowserRelayerClient,
  createIndexedDbPublicKeyStore,
} from "@liyincode/fhevm-sdk/core";

const config = createFhevmConfig({
  chains: [
    {
      id: 11155111,
      name: "Zama Sepolia",
      relayer: {
        acl: "0x6878...",
        kms: "0x1364...",
        inputVerifier: "0xbc91...",
      },
      metadata: {
        relayerConfig: {
          gatewayChainId: 55815,
          relayerUrl: "https://relayer.testnet.zama.cloud",
          verifyingContractAddressDecryption: "0xb6E1...",
          verifyingContractAddressInputVerification: "0x7048...",
        },
      },
    },
  ],
  relayerClient: createBrowserRelayerClient(),
  publicKeyStore: createIndexedDbPublicKeyStore(),
});

const client = createFhevmClient(config);
const instance = await client.createInstance({
  provider: window.ethereum,
  chainId: 11155111,
});
```

### React Usage

```tsx
import { useMemo } from "react";
import { createBrowserFhevmConfig } from "@liyincode/fhevm-sdk/core";
import { FhevmProvider, useFhevmInstance, useEncryptedInput, useUserDecrypt } from "@liyincode/fhevm-sdk/react";

function App() {
  const config = useMemo(() => createBrowserFhevmConfig({ chains: [chainDefinition] }), []);
  const provider = window.ethereum;

  return (
    <FhevmProvider config={config} provider={provider}>
      <YourComponent />
    </FhevmProvider>
  );
}
```

Main hooks:

- `useFhevmInstance()` - Get FHEVM instance
- `useEncryptedInput()` - Encrypt input parameters
- `useUserDecrypt()` - Decrypt on-chain ciphertexts

### Vue Usage

```ts
// main.ts
import { createApp } from "vue";
import { createFhevmVuePlugin } from "@liyincode/fhevm-sdk/vue";

const plugin = createFhevmVuePlugin({
  config: yourConfig,
  provider: window.ethereum
});

createApp(App).use(plugin).mount("#app");
```

Main composables:

- `useFhevmInstance()` - Get FHEVM instance
- `useEncryptedInput()` - Encrypt input parameters
- `useUserDecrypt()` - Decrypt on-chain ciphertexts

### Node.js Usage

```ts
import { createNodeFhevmClient } from "@liyincode/fhevm-sdk/node";

const client = createNodeFhevmClient({
  chains: [yourChainDefinition],
  directory: "./.fhevm-cache",
  relayerClient: yourRelayerClient,
});

const instance = await client.createInstance({ 
  provider: rpcUrl, 
  chainId: 11155111 
});

const keypair = instance.generateKeypair();
console.log("Public key:", keypair.publicKey);
```

## Testing & Building

```bash
cd packages/fhevm-sdk

# Run tests
pnpm test

# Build
pnpm build

# Clean build artifacts
pnpm clean
```

Build output is generated in `dist/`.

## Project Structure

```text
packages/fhevm-sdk/
├── src/
│   ├── core/           # Core module (environment-agnostic)
│   ├── platform/       # Platform adapters
│   │   ├── react/      # React hooks
│   │   ├── vue/        # Vue composables
│   │   └── node/       # Node.js utilities
│   ├── shared/         # Shared types and utilities
│   └── internals/      # Internal implementation
├── test/               # Unit tests
└── dist/               # Build artifacts (included in package)
```

## API Documentation

For detailed API documentation, see:

- **Core API**: Configuration and instance management
- **React API**: React hooks and components
- **Vue API**: Vue composables and plugin
- **Node API**: Node.js environment utilities

## Resources

- Zama FHEVM Documentation: [docs.zama.ai](https://docs.zama.ai/)
- Zama Relayer SDK: [@zama-fhe/relayer-sdk](https://www.npmjs.com/package/@zama-fhe/relayer-sdk)

## License

BSD-3-Clause-Clear - See [LICENSE](./LICENSE) file for details

## Contributing

Issues and Pull Requests are welcome!

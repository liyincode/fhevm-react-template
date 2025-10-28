# Node module overview

- `filePublicKeyStore.ts`: file-system based storage for ACL public keys and TFHE params.
- `config.ts`: `createNodeFhevmConfig` factory that combines file store with a relayer adapter (defaults to noop).
- `index.ts`: entry point re-exporting Node utilities.
- `examples/node/basic.ts`: minimal script showcasing how to assemble a Node config and instantiate the relayer using environment variables.

# Node.js FHEVM Example

Demonstrates FHEVM encryption, user decryption, and encrypted transactions in Node.js.

## Setup

1. Install dependencies: `pnpm install`
2. Get Sepolia ETH: https://sepoliafaucet.com/

## Environment Variables

Create a `.env` file in `packages/fhevm-sdk/examples/node/`:

```bash
# Required - All four variables must be provided
RELAYER_URL=https://relayer.testnet.zama.cloud
RPC_URL=https://eth-sepolia.public.blastapi.io
CONTRACT_ADDRESS=0xfF0d4AFea28F18d1BE61eBe3109951a8eB5E4CA3
PRIVATE_KEY=0xYourPrivateKey

# Optional
# CHAIN_ID=11155111
# GATEWAY_CHAIN_ID=55815
```

## Run

```bash
pnpm --filter @liyincode/fhevm-sdk exec tsx examples/node/basic.ts
```

## Output

```
📦 Initializing FHEVM client...
✅ FHEVM instance ready

📖 Reading counter...
   Current value: 5

🔐 Encrypting and submitting increment...
   Transaction: 0x768aa6b...

📖 Reading updated counter...
   Updated value: 6

🎉 Success! Counter: 5 → 6
```

## Notes

- First run may show no initial value (no decrypt permission yet)
- After first `increment()`, contract grants decrypt permission
- Public keys cached in `.fhevm-cache/`

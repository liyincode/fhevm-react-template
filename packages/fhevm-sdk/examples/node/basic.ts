import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonRpcProvider, Wallet, Contract, ZeroHash } from 'ethers';
import { createNodeFhevmClient, createNodeRelayerAdapter } from '../../src/platform/node';
import { encryptInput } from '../../src/core/crypto/encryption';
import { publicDecrypt, userDecrypt } from '../../src/core/crypto/decryption';
import { GenericStringInMemoryStorage } from '../../src/shared/storage/GenericStringStorage';
import { SepoliaConfig } from '@zama-fhe/relayer-sdk/node';

// Load .env file from script directory
// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '.env') });

const FHE_COUNTER_ABI = [
  {
    inputs: [],
    name: 'getCount',
    outputs: [{ internalType: 'euint32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'externalEuint32', name: 'inputEuint32', type: 'bytes32' },
      { internalType: 'bytes', name: 'inputProof', type: 'bytes' },
    ],
    name: 'increment',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const signatureStorage = new GenericStringInMemoryStorage();

async function readCounter(instance: any, contract: Contract, wallet: Wallet) {
  const handle = (await contract.getCount()) as `0x${string}`;
  if (handle === ZeroHash) return null;

  try {
    const { result } = await userDecrypt({
      instance,
      signer: wallet,
      requests: [{ handle, contractAddress: contract.target as `0x${string}` }],
      storage: signatureStorage,
    });
    return result[handle];
  } catch (error: any) {
    if (error.message?.includes('not authorized')) return null;
    throw error;
  }
}

async function incrementCounter(instance: any, contract: Contract, wallet: Wallet) {
  const payload = await encryptInput({
    instance,
    contractAddress: contract.target as `0x${string}`,
    userAddress: (await wallet.getAddress()) as `0x${string}`,
    build(builder) {
      builder.add32(1);
    },
  });

  // @ts-ignore
    const tx = await contract.connect(wallet).increment(payload.handles[0], payload.inputProof);
  await tx.wait();
  return tx.hash;
}

async function main() {
  const relayerUrl = process.env.RELAYER_URL;
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.CONTRACT_ADDRESS as `0x${string}` | undefined;
  const privateKey = process.env.PRIVATE_KEY;

  if (!relayerUrl || !rpcUrl || !contractAddress || !privateKey) {
    console.log('❌ Missing required environment variables in .env file:');
    if (!relayerUrl) console.log('   - RELAYER_URL');
    if (!rpcUrl) console.log('   - RPC_URL');
    if (!contractAddress) console.log('   - CONTRACT_ADDRESS');
    if (!privateKey) console.log('   - PRIVATE_KEY');
    return;
  }

  const chainId = Number(process.env.CHAIN_ID ?? SepoliaConfig.chainId ?? 11155111);
  const gatewayChainId = Number(process.env.GATEWAY_CHAIN_ID ?? SepoliaConfig.gatewayChainId);

  console.log('📦 Initializing FHEVM client...');

  // 1. Create FHEVM client
  const client = createNodeFhevmClient({
    chains: [
      {
        id: chainId,
        name: 'Zama Sepolia',
        relayer: {
          acl: SepoliaConfig.aclContractAddress as `0x${string}`,
          kms: SepoliaConfig.kmsContractAddress as `0x${string}`,
          inputVerifier: SepoliaConfig.inputVerifierContractAddress as `0x${string}`,
        },
        metadata: {
          relayerConfig: {
            relayerUrl,
            network: rpcUrl,
            gatewayChainId,
            verifyingContractAddressDecryption: SepoliaConfig.verifyingContractAddressDecryption,
            verifyingContractAddressInputVerification: SepoliaConfig.verifyingContractAddressInputVerification,
          },
        },
      },
    ],
    directory: path.resolve(__dirname, '.fhevm-cache'),
    relayerClient: createNodeRelayerAdapter({ relayerUrl, rpcUrl, gatewayChainId }),
    configOverrides: { defaultChainId: chainId },
  });

  // 2. Create instance
  const instance = await client.createInstance({ provider: rpcUrl, chainId });
  console.log('✅ FHEVM instance ready\n');

  // 3. Setup contract
  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);
  const contract = new Contract(contractAddress, FHE_COUNTER_ABI, provider);

  // 4. Read current counter value
  console.log('📖 Reading counter...');
  const before = await readCounter(instance, contract, wallet);
  if (before !== null) console.log(`   Current value: ${before}`);

  // 5. Encrypt and submit increment transaction
  console.log('\n🔐 Encrypting and submitting increment...');
  const txHash = await incrementCounter(instance, contract, wallet);
  console.log(`   Transaction: ${txHash}`);

  // 6. Read updated counter value
  console.log('\n📖 Reading updated counter...');
  const after = await readCounter(instance, contract, wallet);
  if (after !== null) console.log(`   Updated value: ${after}`);

  // 7. Display result
  if (before !== null && after !== null) {
    console.log(`\n🎉 Success! Counter: ${before} → ${after}`);
  } else if (after !== null) {
    console.log(`\n🎉 Success! Counter value: ${after}`);
  }
}

main().catch(err => {
  console.error('Unhandled error in node example:', err);
  process.exit(1);
});

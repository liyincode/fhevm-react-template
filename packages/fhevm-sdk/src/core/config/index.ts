import type { FhevmInstance, FhevmInstanceConfig } from "../../shared/types/fhevmTypes";
import type { FhevmInitSDKOptions } from "../../internals/fhevmTypes";
import type { GenericStringStorage } from "../../shared/storage/GenericStringStorage";

type ConsoleLike = Pick<Console, "log" | "warn" | "error">;

// Abstraction over how the relayer SDK bundle is loaded and invoked.
export type RelayerClientAdapter = {
  load(): Promise<void>;
  init(options?: FhevmInitSDKOptions): Promise<boolean>;
  createInstance(config: FhevmInstanceConfig): Promise<FhevmInstance>;
  getSepoliaConfig?: () => FhevmInstanceConfig | undefined;
};

// Lightweight chain descriptor used by the new configuration entry point.
export type ChainDefinition = {
  id: number;
  name: string;
  rpcUrl?: string;
  relayer?: {
    acl?: `0x${string}`;
    kms?: `0x${string}`;
    inputVerifier?: `0x${string}`;
  };
  metadata?: {
    kmsPublicKeyUrl?: string;
    relayerConfig?: Partial<FhevmInstanceConfig>;
    [key: string]: unknown;
  };
  allowMock?: boolean;
};

// Normalized record storing cached ACL public keys and params.
export type PublicKeyRecord = {
  publicKey?: {
    id: string | null;
    data: Uint8Array | null;
  };
  publicParams?: {
    [bits: string]: {
      publicParamsId: string;
      publicParams: Uint8Array;
    };
  } | null;
};

export interface PublicKeyStore {
  get(aclAddress: `0x${string}`): Promise<PublicKeyRecord | null>;
  set(aclAddress: `0x${string}`, value: PublicKeyRecord): Promise<void>;
  delete(aclAddress: `0x${string}`): Promise<void>;
}

// Shape accepted by createFhevmConfig when bootstrapping the SDK.
export type FhevmConfigOptions = {
  defaultChainId?: number;
  chains: ChainDefinition[];
  relayerClient: RelayerClientAdapter;
  publicKeyStore: PublicKeyStore;
  signatureStorage?: GenericStringStorage;
  mockChains?: Record<number, string>;
  logger?: ConsoleLike;
};

// Fully resolved configuration object shared across the SDK.
export type FhevmConfig = {
  defaultChainId?: number;
  chains: Map<number, ChainDefinition>;
  relayerClient: RelayerClientAdapter;
  publicKeyStore: PublicKeyStore;
  signatureStorage?: GenericStringStorage;
  mockChains: Record<number, string>;
  logger: ConsoleLike;
};

// Small helper that normalizes arrays/maps and fills defaults.
export const createFhevmConfig = (options: FhevmConfigOptions): FhevmConfig => {
  const {
    defaultChainId,
    chains,
    relayerClient,
    publicKeyStore,
    signatureStorage,
    mockChains = {},
    logger = console,
  } = options;

  const chainMap = new Map<number, ChainDefinition>();
  for (const chain of chains) {
    chainMap.set(chain.id, chain);
  }

  const resolvedDefaultChainId = (() => {
    if (typeof defaultChainId === "number") {
      return defaultChainId;
    }
    const firstChain = chains[0]?.id;
    return typeof firstChain === "number" ? firstChain : undefined;
  })();

  return {
    defaultChainId: resolvedDefaultChainId,
    chains: chainMap,
    relayerClient,
    publicKeyStore,
    signatureStorage,
    mockChains,
    logger,
  };
};

// Helper for consumers that need to read chain metadata from the config.
export const getChainFromConfig = (config: FhevmConfig, chainId: number | undefined): ChainDefinition | null => {
  if (typeof chainId !== "number") {
    return null;
  }

  const chain = config.chains.get(chainId);
  if (!chain) {
    throw new Error(`Chain with id ${chainId} is not registered in FHEVM config.`);
  }
  return chain;
};

export const resolveDefaultChainId = (
  chainId: number | undefined,
  config: FhevmConfig,
  isMockEnvironment?: boolean
): number => {
  // If chainId is explicitly provided, use it
  if (typeof chainId === "number") {
    return chainId;
  }

  // In mock environment, try to use mock chain ID first
  if (isMockEnvironment && config.mockChains && Object.keys(config.mockChains).length > 0) {
    const mockChainIds = Object.keys(config.mockChains).map(Number);
    return mockChainIds[0];
  }

  // Use config default or first chain
  const id = config.defaultChainId ?? [...config.chains.keys()][0];
  if (typeof id !== "number") {
    throw new Error("No chain ID provided and no default chain ID found in config");
  }
  return id;
};

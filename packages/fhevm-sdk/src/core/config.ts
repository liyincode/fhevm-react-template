import type { FhevmInstance, FhevmInstanceConfig } from "../fhevmTypes";
import type { FhevmInitSDKOptions } from "../internal/fhevmTypes";
import type { GenericStringStorage } from "../storage/GenericStringStorage";

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
export const getChainFromConfig = (config: FhevmConfig, chainId: number): ChainDefinition => {
  const chain = config.chains.get(chainId);
  if (!chain) {
    throw new Error(`Chain with id ${chainId} is not registered in FHEVM config.`);
  }
  return chain;
};

export const resolveDefaultChainId = (config: FhevmConfig): number => {
  const id = config.defaultChainId ?? [...config.chains.keys()][0];
  if (typeof id !== "number") {
    throw new Error("FHEVM config requires at least one chain or an explicit defaultChainId.");
  }
  return id;
};

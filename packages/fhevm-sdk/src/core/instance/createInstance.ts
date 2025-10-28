import { JsonRpcProvider, type Eip1193Provider } from "ethers";
import type { FhevmInstance, FhevmInstanceConfig } from "../../shared/types/fhevmTypes";
import { FhevmAbortError, FhevmError } from "../errors";
import { getChainFromConfig } from "../config";
import type { ChainDefinition, FhevmConfig } from "../config";

class FhevmInstanceError extends FhevmError {
  code: string;
  constructor(code: string, message?: string, options?: ErrorOptions) {
    super(message || "FHEVM instance error", options);
    this.code = code;
    this.name = "FhevmInstanceError";
  }
}

function throwFhevmError(code: string, message?: string, cause?: unknown): never {
  throw new FhevmInstanceError(code, message, cause ? { cause } : undefined);
}

type FhevmRelayerStatusType =
  | "sdk-loading"
  | "sdk-loaded"
  | "sdk-initializing"
  | "sdk-initialized"
  | "creating";

export type CreateInstanceOptions = {
  provider: string | unknown;
  chainId?: number;
  signal?: AbortSignal;
  onStatusChange?: (status: string) => void;
};

/**
 * Creates a configured FHEVM instance using the provided configuration.
 * 
 * Handles:
 * - Relayer SDK initialization and loading
 * - Network resolution (distinguishes real vs mock chains)
 * - Public key and params caching via configured store
 * - Abort signal handling for cancellable operations
 * 
 * @param config - FHEVM configuration with chains, adapters, and storage
 * @param options - Instance creation options (provider, chainId, signal)
 * @returns Promise resolving to instance, chainId, and abort function
 */
export const createConfiguredFhevmInstance = async (
  config: FhevmConfig,
  options: CreateInstanceOptions
) => {
  const { provider, chainId, signal, onStatusChange } = options;

  const abortController = signal ? undefined : new AbortController();
  const abortSignal = signal ?? abortController!.signal;

  await ensureRelayerReady(config, abortSignal, status => notifyStatus(onStatusChange, status));

  const providerOrUrl = provider ?? (typeof window !== "undefined" ? (window as any).ethereum : undefined);
  if (!providerOrUrl) {
    throw new Error("createConfiguredFhevmInstance: provider is required.");
  }

  const networkResolution = await resolveNetwork(providerOrUrl as Eip1193Provider | string, config.mockChains);
  const effectiveChainId = chainId ?? networkResolution.chainId;
  if (!effectiveChainId) {
    throw new Error("createConfiguredFhevmInstance: unable to resolve chainId.");
  }

  let instance: FhevmInstance;

  if (networkResolution.isMock) {
    notifyStatus(onStatusChange, "creating");
    instance = await createMockInstance(networkResolution, abortSignal);
  } else {
    const { relayerInstance, aclAddress } = await createRelayerBackedInstance({
      config,
      providerOrUrl,
      signal: abortSignal,
      chainId: effectiveChainId,
      notify: status => notifyStatus(onStatusChange, status),
    });
    instance = await wrapInstanceWithStore(relayerInstance, config, effectiveChainId, aclAddress);
  }

  return {
    instance,
    chainId: effectiveChainId,
    abort: () => abortController?.abort(),
  };
};

// Persist public key/params into the injected store immediately after creation.
const wrapInstanceWithStore = async (
  instance: FhevmInstance,
  config: FhevmConfig,
  chainId: number,
  aclAddressOverride?: `0x${string}`
) => {
  if (!config.publicKeyStore) {
    return instance;
  }

  let aclAddress: `0x${string}` | undefined = aclAddressOverride;

  if (!aclAddress) {
    const chain = (() => {
      try {
        return getChainFromConfig(config, chainId);
      } catch {
        return null;
      }
    })();
    if (chain?.relayer?.acl) {
      aclAddress = chain.relayer.acl;
    }
  }

  if (!aclAddress) {
    const sepoliaConfig = config.relayerClient.getSepoliaConfig?.();
    if (sepoliaConfig?.aclContractAddress) {
      aclAddress = sepoliaConfig.aclContractAddress as `0x${string}`;
    }
  }
  if (!aclAddress || typeof aclAddress !== "string" || !aclAddress.startsWith("0x")) {
    return instance;
  }

  const cached = await config.publicKeyStore.get(aclAddress as `0x${string}`);
  if (cached?.publicKey && cached.publicParams) {
    return instance;
  }

  const [publicKey, publicParams] = await Promise.all([
    instance.getPublicKey(),
    instance.getPublicParams(2048),
  ]);

  await config.publicKeyStore.set(aclAddress as `0x${string}`, {
    publicKey: publicKey ? { id: publicKey.publicKeyId ?? null, data: publicKey.publicKey ?? null } : undefined,
    publicParams: publicParams
      ? {
          "2048": {
            publicParamsId: publicParams.publicParamsId,
            publicParams: publicParams.publicParams,
          },
        }
      : null,
  });

  return instance;
};

const ensureRelayerReady = async (
  config: FhevmConfig,
  signal: AbortSignal,
  notify?: (status: FhevmRelayerStatusType) => void
) => {
  const throwIfAborted = () => {
    if (signal.aborted) {
      throw new FhevmAbortError();
    }
  };

  const { relayerClient, logger } = config;

  try {
    notify?.("sdk-loading");
    await relayerClient.load();
    throwIfAborted();

    notify?.("sdk-loaded");
    notify?.("sdk-initializing");
    const initialized = await relayerClient.init();
    throwIfAborted();

    notify?.("sdk-initialized");
    if (initialized !== true) {
      logger.warn?.("Relayer client init() returned false; continuing with instance creation.");
    }
  } catch (error) {
    logger.error?.("Failed to prepare relayer client", error);
    throw error;
  }
};

const notifyStatus = (
  callback: ((status: FhevmRelayerStatusType) => void) | undefined,
  status: FhevmRelayerStatusType
) => {
  if (callback) callback(status);
};

type MockNetworkResolution = { isMock: true; chainId: number; rpcUrl: string };
type RealNetworkResolution = { isMock: false; chainId: number; rpcUrl?: string };
type NetworkResolution = MockNetworkResolution | RealNetworkResolution;

const resolveNetwork = async (
  providerOrUrl: Eip1193Provider | string,
  mockChains: Record<number, string>
): Promise<NetworkResolution> => {
  const chainId = await getChainId(providerOrUrl);

  let rpcUrl = typeof providerOrUrl === "string" ? providerOrUrl : undefined;

  const combinedMocks: Record<number, string> = {
    31337: "http://localhost:8545",
    ...mockChains,
  };

  if (Object.hasOwn(combinedMocks, chainId)) {
    if (!rpcUrl) {
      rpcUrl = combinedMocks[chainId];
    }
    if (!rpcUrl) {
      throw new Error(`Mock chain ${chainId} requires a RPC endpoint.`);
    }
    return { isMock: true, chainId, rpcUrl };
  }

  return { isMock: false, chainId, rpcUrl };
};

const isHexAddress = (value: unknown): value is `0x${string}` => {
  return typeof value === "string" && value.startsWith("0x");
};

const getChainDefinition = (config: FhevmConfig, chainId: number): ChainDefinition | undefined => {
  try {
    const chain = getChainFromConfig(config, chainId);
    return chain ?? undefined;
  } catch {
    return undefined;
  }
};

const buildRelayerConfigOverrides = (
  chain: ChainDefinition | undefined
): Partial<FhevmInstanceConfig> => {
  if (!chain) {
    return {};
  }

  const overrides: Partial<FhevmInstanceConfig> = {
    ...(chain.metadata?.relayerConfig ?? {}),
  };

  if (chain.metadata?.kmsPublicKeyUrl) {
    (overrides as Record<string, unknown>).kmsPublicKeyUrl = chain.metadata.kmsPublicKeyUrl;
  }
  if (chain.relayer?.acl) {
    overrides.aclContractAddress = chain.relayer.acl;
  }
  if (chain.relayer?.kms) {
    overrides.kmsContractAddress = chain.relayer.kms;
  }
  if (chain.relayer?.inputVerifier) {
    overrides.inputVerifierContractAddress = chain.relayer.inputVerifier;
  }

  return overrides;
};

const resolveRelayerInstanceConfig = (
  config: FhevmConfig,
  chainId: number
): FhevmInstanceConfig => {
  const baseConfig = config.relayerClient.getSepoliaConfig?.();
  const chain = getChainDefinition(config, chainId);
  const overrides = buildRelayerConfigOverrides(chain);

  const merged: Partial<FhevmInstanceConfig> = {
    ...(baseConfig ?? {}),
    ...overrides,
  };

  const missing: string[] = [];
  if (!isHexAddress(merged.aclContractAddress)) {
    missing.push("aclContractAddress");
  }
  if (!isHexAddress(merged.kmsContractAddress)) {
    missing.push("kmsContractAddress");
  }
  if (!isHexAddress(merged.inputVerifierContractAddress)) {
    missing.push("inputVerifierContractAddress");
  }

  if (missing.length > 0) {
    throw new Error(
      `Relayer configuration is missing fields: ${missing.join(
        ", "
      )}. Provide them via chain metadata or the relayer client adapter.`
    );
  }

  return merged as FhevmInstanceConfig;
};

const createMockInstance = async (
  resolution: MockNetworkResolution,
  signal: AbortSignal
): Promise<FhevmInstance> => {
  const throwIfAborted = () => {
    if (signal.aborted) throw new FhevmAbortError();
  };

  throwIfAborted();
  const metadata = await tryFetchFHEVMHardhatNodeRelayerMetadata(resolution.rpcUrl);
  throwIfAborted();

  if (!metadata) {
    throw new Error("Unable to fetch FHEVM relayer metadata for Hardhat node.");
  }

  const fhevmMock = await import("../../internals/mock/fhevmMock");
  const mockInstance = await fhevmMock.fhevmMockCreateInstance({
    rpcUrl: resolution.rpcUrl,
    chainId: resolution.chainId,
    metadata,
  });

  throwIfAborted();
  return mockInstance;
};

const createRelayerBackedInstance = async (parameters: {
  config: FhevmConfig;
  providerOrUrl: Eip1193Provider | string;
  chainId: number;
  signal: AbortSignal;
  notify: (status: FhevmRelayerStatusType) => void;
}): Promise<{ relayerInstance: FhevmInstance; aclAddress: `0x${string}` }> => {
  const { config, providerOrUrl, signal, notify, chainId } = parameters;
  const throwIfAborted = () => {
    if (signal.aborted) throw new FhevmAbortError();
  };

  const relayerConfig = resolveRelayerInstanceConfig(config, chainId);
  const aclAddress = relayerConfig.aclContractAddress as `0x${string}`;

  const cached = await config.publicKeyStore?.get(aclAddress);
  throwIfAborted();

  notify("creating");

  const relayerInstance = await config.relayerClient.createInstance({
    ...relayerConfig,
    network: providerOrUrl,
    publicKey: cached?.publicKey,
    publicParams: cached?.publicParams ?? null,
  });

  throwIfAborted();
  return { relayerInstance, aclAddress };
};

async function getChainId(providerOrUrl: Eip1193Provider | string): Promise<number> {
  if (typeof providerOrUrl === "string") {
    const provider = new JsonRpcProvider(providerOrUrl);
    try {
      return Number((await provider.getNetwork()).chainId);
    } finally {
      provider.destroy();
    }
  }
  const chainId = await providerOrUrl.request({ method: "eth_chainId" });
  return Number.parseInt(chainId as string, 16);
}

async function getWeb3Client(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const version = await rpc.send("web3_clientVersion", []);
    return version;
  } catch (e) {
    throwFhevmError(
      "WEB3_CLIENTVERSION_ERROR",
      `The URL ${rpcUrl} is not a Web3 node or is not reachable. Please check the endpoint.`,
      e
    );
  } finally {
    rpc.destroy();
  }
}

async function tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl: string) {
  const version = await getWeb3Client(rpcUrl);
  if (typeof version !== "string" || !version.toLowerCase().includes("hardhat")) {
    return undefined;
  }
  try {
    const metadata = await getFHEVMRelayerMetadata(rpcUrl);
    if (!metadata || typeof metadata !== "object") {
      return undefined;
    }
    const { ACLAddress, InputVerifierAddress, KMSVerifierAddress } = metadata as Record<string, unknown>;
    if (
      typeof ACLAddress === "string" &&
      ACLAddress.startsWith("0x") &&
      typeof InputVerifierAddress === "string" &&
      InputVerifierAddress.startsWith("0x") &&
      typeof KMSVerifierAddress === "string" &&
      KMSVerifierAddress.startsWith("0x")
    ) {
      return metadata as {
        ACLAddress: `0x${string}`;
        InputVerifierAddress: `0x${string}`;
        KMSVerifierAddress: `0x${string}`;
      };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

async function getFHEVMRelayerMetadata(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const version = await rpc.send("fhevm_relayer_metadata", []);
    return version;
  } catch (e) {
    throwFhevmError(
      "FHEVM_RELAYER_METADATA_ERROR",
      `The URL ${rpcUrl} is not a FHEVM Hardhat node or is not reachable. Please check the endpoint.`,
      e
    );
  } finally {
    rpc.destroy();
  }
}

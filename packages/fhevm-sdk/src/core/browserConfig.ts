import { createBrowserRelayerClient } from "./adapters/browserRelayerClient";
import { createIndexedDbPublicKeyStore } from "./adapters/indexedDbPublicKeyStore";
import { createFhevmConfig, type ChainDefinition, type FhevmConfig, type FhevmConfigOptions, type PublicKeyStore, type RelayerClientAdapter } from "./config";

export type BrowserFhevmConfigOptions = {
  chains: ChainDefinition[];
  mockChains?: Record<number, string>;
  relayerClient?: RelayerClientAdapter;
  publicKeyStore?: PublicKeyStore;
  configOverrides?: Partial<Omit<FhevmConfigOptions, "chains" | "relayerClient" | "publicKeyStore">>;
};

export const createBrowserFhevmConfig = (options: BrowserFhevmConfigOptions): FhevmConfig => {
  const { chains, mockChains, relayerClient, publicKeyStore, configOverrides } = options;

  const resolvedRelayer = relayerClient ?? createBrowserRelayerClient();
  const resolvedStore = publicKeyStore ?? createIndexedDbPublicKeyStore();

  return createFhevmConfig({
    defaultChainId: configOverrides?.defaultChainId,
    chains,
    relayerClient: resolvedRelayer,
    publicKeyStore: resolvedStore,
    signatureStorage: configOverrides?.signatureStorage,
    mockChains: mockChains ?? configOverrides?.mockChains,
    logger: configOverrides?.logger,
  });
};

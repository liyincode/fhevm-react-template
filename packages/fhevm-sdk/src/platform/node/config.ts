import { createNoopRelayerClient } from "../../core/adapters/relayer/noop";
import {
  createFhevmConfig,
  type ChainDefinition,
  type FhevmConfig,
  type FhevmConfigOptions,
  type PublicKeyStore,
  type RelayerClientAdapter,
} from "../../core/config";
import { createFilePublicKeyStore } from "./filePublicKeyStore";

export type NodeFhevmConfigOptions = {
  chains: ChainDefinition[];
  directory: string;
  relayerClient?: RelayerClientAdapter;
  publicKeyStore?: PublicKeyStore;
  configOverrides?: Partial<Omit<FhevmConfigOptions, "chains" | "relayerClient" | "publicKeyStore">>;
};

// Convenience wrapper for Node environments: wires file-based key store with provided chains.
export const createNodeFhevmConfig = (options: NodeFhevmConfigOptions): FhevmConfig => {
  const { chains, directory, relayerClient, publicKeyStore, configOverrides } = options;

  const resolvedRelayer = relayerClient ?? createNoopRelayerClient();
  const resolvedStore = publicKeyStore ?? createFilePublicKeyStore(directory);

  return createFhevmConfig({
    defaultChainId: configOverrides?.defaultChainId,
    chains,
    relayerClient: resolvedRelayer,
    publicKeyStore: resolvedStore,
    signatureStorage: configOverrides?.signatureStorage,
    mockChains: configOverrides?.mockChains,
    logger: configOverrides?.logger,
  });
};

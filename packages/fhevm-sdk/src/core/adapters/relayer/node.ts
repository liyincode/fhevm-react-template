import type { FhevmInstanceConfig } from "../../../shared/types/fhevmTypes";
import type { RelayerClientAdapter } from "../../config";
import { createInstance as createRelayerInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

export type NodeRelayerAdapterOptions = {
  relayerUrl: string;
  rpcUrl: string;
  gatewayChainId?: number;
  getBaseConfig?: () => FhevmInstanceConfig;
};

const unwrapPublicKey = (config: FhevmInstanceConfig) => {
  if (!config.publicKey) {
    return config;
  }

  const cloned: Record<string, unknown> = { ...config };

  if (typeof config.publicKey === "object" && "data" in config.publicKey) {
    const data = (config.publicKey as { data?: Uint8Array | null }).data;
    if (data instanceof Uint8Array) {
      cloned.publicKey = data;
    } else {
      delete cloned.publicKey;
    }
  }

  if ("publicParams" in cloned) {
    delete cloned.publicParams;
  }

  return cloned as FhevmInstanceConfig;
};

export const createNodeRelayerAdapter = (options: NodeRelayerAdapterOptions): RelayerClientAdapter => {
  const getBaseConfig = options.getBaseConfig ?? (() => ({ ...SepoliaConfig }));

  return {
    async load(): Promise<void> {},
    async init(): Promise<boolean> {
      return true;
    },
    getSepoliaConfig(): FhevmInstanceConfig {
      return getBaseConfig();
    },
    async createInstance(config: FhevmInstanceConfig) {
      const base = getBaseConfig();
      const merged = unwrapPublicKey({
        ...base,
        ...config,
        relayerUrl: options.relayerUrl,
        network: options.rpcUrl,
        gatewayChainId: config.gatewayChainId ?? options.gatewayChainId ?? base.gatewayChainId,
      });

      return createRelayerInstance(merged);
    },
  };
};

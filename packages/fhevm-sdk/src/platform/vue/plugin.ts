import type { App, Plugin } from "vue";
import { inject } from "vue";
import type { Eip1193Provider } from "ethers";
import type { FhevmConfig, PublicKeyStore } from "../../core/config";
import type { GenericStringStorage } from "../../shared/storage/GenericStringStorage";

type ProviderLike = Eip1193Provider | string;

// Vue plugin options mirror the React provider props but allow lazy default provider lookup.
export type FhevmVuePluginOptions = {
  config: FhevmConfig;
  chainId?: number;
  provider?: ProviderLike;
  defaultProvider?: ProviderLike | (() => ProviderLike | undefined);
  storageOverrides?: {
    publicKeyStore?: PublicKeyStore;
    signatureStorage?: GenericStringStorage;
  };
};

export type FhevmVueContext = {
  config: FhevmConfig;
  chainId?: number;
  provider?: ProviderLike;
  publicKeyStore: PublicKeyStore;
  signatureStorage?: GenericStringStorage;
  defaultProvider?: () => ProviderLike | undefined;
};

const FhevmSymbol = Symbol("FhevmVueContext");

// Allow Vue apps to override the storage implementations without mutating the original config.
const applyStorageOverrides = (
  config: FhevmConfig,
  overrides?: FhevmVuePluginOptions["storageOverrides"],
): FhevmConfig => {
  if (!overrides) {
    return config;
  }

  const publicKeyStore = overrides.publicKeyStore ?? config.publicKeyStore;
  const signatureStorage = overrides.signatureStorage ?? config.signatureStorage;

  if (
    publicKeyStore === config.publicKeyStore &&
    signatureStorage === config.signatureStorage
  ) {
    return config;
  }

  return {
    ...config,
    publicKeyStore,
    signatureStorage,
  };
};

// Resolve a default provider getter in the order: explicit function -> explicit value -> plugin provider -> window.ethereum.
const normalizeDefaultProvider = (
  options: Pick<FhevmVuePluginOptions, "provider" | "defaultProvider">,
): (() => ProviderLike | undefined) | undefined => {
  const { provider, defaultProvider } = options;

  if (typeof defaultProvider === "function") {
    return () => defaultProvider();
  }

  if (defaultProvider !== undefined) {
    return () => defaultProvider;
  }

  if (provider !== undefined) {
    return () => provider;
  }

  return () =>
    (typeof window !== "undefined"
      ? (window as { ethereum?: ProviderLike }).ethereum
      : undefined);
};

// Installable plugin that exposes FHEVM configuration via provide/inject.
export const createFhevmVuePlugin = (options: FhevmVuePluginOptions): Plugin => {
  const { config, chainId, provider, storageOverrides } = options;

  const derivedConfig = applyStorageOverrides(config, storageOverrides);
  const defaultProvider = normalizeDefaultProvider(options);

  const context: FhevmVueContext = {
    config: derivedConfig,
    chainId,
    provider,
    publicKeyStore: derivedConfig.publicKeyStore,
    signatureStorage: derivedConfig.signatureStorage,
    defaultProvider,
  };

  return {
    install(app: App) {
      app.provide(FhevmSymbol, context);
    },
  };
};

// Guarded injector so composables fail fast when used outside the plugin.
export const useFhevmContext = (): FhevmVueContext => {
  const context = inject<FhevmVueContext | null>(FhevmSymbol, null);
  if (!context) {
    throw new Error("FHEVM composables must be used within createFhevmVuePlugin().");
  }
  return context;
};

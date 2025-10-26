"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Eip1193Provider } from "ethers";
import type { FhevmConfig, PublicKeyStore } from "../core/config";
import type { GenericStringStorage } from "../storage/GenericStringStorage";

export type FhevmProviderStorageOverrides = {
  publicKeyStore?: PublicKeyStore;
  signatureStorage?: GenericStringStorage;
};

export type FhevmProviderProps = {
  config: FhevmConfig;
  chainId?: number;
  provider?: Eip1193Provider | string;
  storageOverrides?: FhevmProviderStorageOverrides;
  children: ReactNode;
};

type FhevmContextValue = {
  config: FhevmConfig;
  chainId?: number;
  provider?: Eip1193Provider | string;
  publicKeyStore: PublicKeyStore;
  signatureStorage?: GenericStringStorage;
};

const FhevmContext = createContext<FhevmContextValue | null>(null);

const applyStorageOverrides = (
  config: FhevmConfig,
  overrides?: FhevmProviderStorageOverrides
): FhevmConfig => {
  if (!overrides) {
    return config;
  }

  const nextPublicKeyStore = overrides.publicKeyStore ?? config.publicKeyStore;
  const nextSignatureStorage = overrides.signatureStorage ?? config.signatureStorage;

  if (
    nextPublicKeyStore === config.publicKeyStore &&
    nextSignatureStorage === config.signatureStorage
  ) {
    return config;
  }

  return {
    ...config,
    publicKeyStore: nextPublicKeyStore,
    signatureStorage: nextSignatureStorage,
  };
};

export const FhevmProvider = (props: FhevmProviderProps) => {
  const { config, chainId, provider, storageOverrides, children } = props;

  const derivedConfig = useMemo(
    () => applyStorageOverrides(config, storageOverrides),
    [config, storageOverrides?.publicKeyStore, storageOverrides?.signatureStorage]
  );

  const value = useMemo<FhevmContextValue>(
    () => ({
      config: derivedConfig,
      chainId,
      provider,
      publicKeyStore: derivedConfig.publicKeyStore,
      signatureStorage: derivedConfig.signatureStorage,
    }),
    [derivedConfig, chainId, provider]
  );

  return <FhevmContext.Provider value={value}>{children}</FhevmContext.Provider>;
};

export const useFhevmContext = () => {
  const context = useContext(FhevmContext);
  if (!context) {
    throw new Error("Fhevm hooks must be used within a <FhevmProvider>.");
  }
  return context;
};

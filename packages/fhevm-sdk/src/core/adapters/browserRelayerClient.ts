import { SDK_CDN_URL } from "../../internal/constants";
import type { FhevmInitSDKOptions, FhevmRelayerSDKType, FhevmWindowType } from "../../internal/fhevmTypes";
import type { FhevmInstanceConfig } from "../../fhevmTypes";
import type { RelayerClientAdapter } from "../config";

const loadRelayerScript = async (logger?: ConsoleLike) => {
  if (typeof window === "undefined") {
    throw new Error("BrowserRelayerClient: window is undefined. Use a non-browser adapter instead.");
  }

  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${SDK_CDN_URL}"]`);
  if (existingScript) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_CDN_URL;
    script.type = "text/javascript";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      logger?.error?.("BrowserRelayerClient: failed to load relayer script", SDK_CDN_URL);
      reject(new Error(`Failed to load relayer script from ${SDK_CDN_URL}`));
    };
    document.head.appendChild(script);
  });
};

type ConsoleLike = Pick<Console, "log" | "warn" | "error">;

export type BrowserRelayerClientOptions = {
  logger?: ConsoleLike;
};

const getWindowRelayer = (logger?: ConsoleLike): FhevmRelayerSDKType => {
  if (typeof window === "undefined") {
    throw new Error("BrowserRelayerClient: window is undefined. Use a non-browser adapter instead.");
  }
  const relayer = (window as unknown as FhevmWindowType).relayerSDK;
  if (!relayer) {
    logger?.error?.("BrowserRelayerClient: window.relayerSDK missing.");
    throw new Error("BrowserRelayerClient: relayer SDK not loaded.");
  }
  return relayer;
};

/**
 * Creates a browser-based Relayer client adapter.
 * 
 * Loads the Relayer SDK from CDN (https://cdn.zama.ai/relayer-sdk-js)
 * and provides a unified adapter interface for browser environments.
 * 
 * Features:
 * - Automatic script loading with caching
 * - Window.relayerSDK detection
 * - Error handling and logging
 */
export const createBrowserRelayerClient = (options?: BrowserRelayerClientOptions): RelayerClientAdapter => {
  const logger = options?.logger ?? console;
  return {
    async load(): Promise<void> {
      try {
        await loadRelayerScript(logger);
      } catch (error) {
        logger.error?.("BrowserRelayerClient: load() failed", error);
        throw error;
      }
    },
    async init(initOptions?: FhevmInitSDKOptions): Promise<boolean> {
      const relayer = getWindowRelayer(logger);
      return await relayer.initSDK(initOptions);
    },
    async createInstance(config: FhevmInstanceConfig) {
      const relayer = getWindowRelayer(logger);
      return await relayer.createInstance(config);
    },
    getSepoliaConfig(): FhevmInstanceConfig | undefined {
      try {
        const relayer = getWindowRelayer(logger);
        return relayer.SepoliaConfig;
      } catch {
        return undefined;
      }
    },
  };
};

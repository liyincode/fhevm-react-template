import type { FhevmInstance } from "../fhevmTypes";
import type { FhevmConfig } from "./config";
import { createConfiguredFhevmInstance, type CreateInstanceOptions } from "./instance";

export type FhevmInstanceStatus = "idle" | "loading" | "ready" | "error";

export type FhevmInstanceHandle = {
  status: FhevmInstanceStatus;
  instance?: FhevmInstance;
  error?: Error;
  abort(): void;
  refresh(options?: Partial<CreateInstanceOptions>): Promise<void>;
};

export type CreateInstanceHandleOptions = {
  defaultProvider?: unknown | (() => unknown);
};

const resolveDefaultProvider = (options?: CreateInstanceHandleOptions) => {
  if (!options) {
    return typeof window !== "undefined" ? (window as any)?.ethereum : undefined;
  }
  if (typeof options.defaultProvider === "function") {
    return options.defaultProvider();
  }
  if (options.defaultProvider !== undefined) {
    return options.defaultProvider;
  }
  return typeof window !== "undefined" ? (window as any)?.ethereum : undefined;
};

export const createInstanceHandle = (config: FhevmConfig, handleOptions?: CreateInstanceHandleOptions) => {
  let status: FhevmInstanceStatus = "idle";
  let instance: FhevmInstance | undefined;
  let error: Error | undefined;
  let abortController: AbortController | undefined;

  const notify = (newStatus: FhevmInstanceStatus) => {
    status = newStatus;
  };

  const abort = () => {
    abortController?.abort();
    abortController = undefined;
    status = "idle";
  };

  const refresh = async (refreshOptions: Partial<CreateInstanceOptions> = {}) => {
    abort();
    notify("loading");
    error = undefined;

    abortController = new AbortController();
    const currentController = abortController;
    try {
      const result = await createConfiguredFhevmInstance(config, {
        provider: refreshOptions.provider ?? resolveDefaultProvider(handleOptions),
        chainId: refreshOptions.chainId,
        signal: currentController.signal,
        onStatusChange: refreshOptions.onStatusChange,
      });
      instance = result.instance;
      notify("ready");
    } catch (err) {
      if (currentController.signal.aborted) {
        notify("idle");
        return;
      }
      error = err as Error;
      notify("error");
    }
  };

  return {
    get status() {
      return status;
    },
    get instance() {
      return instance;
    },
    get error() {
      return error;
    },
    abort,
    refresh,
  } satisfies FhevmInstanceHandle;
};

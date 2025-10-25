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

export const createInstanceHandle = (config: FhevmConfig) => {
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

  const refresh = async (options: Partial<CreateInstanceOptions> = {}) => {
    abort();
    notify("loading");
    error = undefined;

    abortController = new AbortController();
    const currentController = abortController;
    try {
      const result = await createConfiguredFhevmInstance(config, {
        provider: options.provider ?? (window as any)?.ethereum,
        chainId: options.chainId,
        signal: currentController.signal,
        onStatusChange: options.onStatusChange,
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

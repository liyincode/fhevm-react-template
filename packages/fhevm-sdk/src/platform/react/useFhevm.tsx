import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Eip1193Provider } from "ethers";
import type { FhevmInstance } from "../../shared/types/fhevmTypes";
import {
  createInstanceHandle,
  type FhevmInstanceHandle,
  type FhevmInstanceStatus,
} from "../../core/instance/handle";
import { resolveDefaultChainId } from "../../core/config";
import { useFhevmContext } from "./FhevmProvider";

export type UseFhevmInstanceOptions = {
  provider?: Eip1193Provider | string;
  chainId?: number;
  enabled?: boolean;
};

export type UseFhevmInstanceResult = {
  instance?: FhevmInstance;
  status: FhevmInstanceStatus;
  error?: Error;
  refresh(): void;
};

const resolveProvider = (
  explicitProvider: Eip1193Provider | string | undefined,
  contextProvider: Eip1193Provider | string | undefined
) => {
  if (explicitProvider) {
    return explicitProvider;
  }
  if (contextProvider) {
    return contextProvider;
  }
  if (typeof window !== "undefined") {
    return (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  }
  return undefined;
};

export const useFhevmInstance = (options: UseFhevmInstanceOptions = {}): UseFhevmInstanceResult => {
  const { provider: contextProvider, chainId: contextChainId, config } = useFhevmContext();

  const resolvedProvider = resolveProvider(options.provider, contextProvider);
  const resolvedChainId = useMemo<number | undefined>(() => {
    if (typeof options.chainId === "number") return options.chainId;
    if (typeof contextChainId === "number") return contextChainId;
    try {
      return resolveDefaultChainId(undefined, config);
    } catch {
      return undefined;
    }
  }, [options.chainId, contextChainId, config]);

  const isEnabled = options.enabled ?? true;

  const handleRef = useRef<FhevmInstanceHandle>(createInstanceHandle(config));
  const [status, setStatus] = useState<FhevmInstanceStatus>("idle");
  const [instance, setInstance] = useState<FhevmInstance | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const refreshToken = useRef(0);

  useEffect(() => {
    handleRef.current = createInstanceHandle(config);
  }, [config]);

  const runRefresh = useCallback(async () => {
    const handle = handleRef.current;
    handle.abort();

    if (!resolvedProvider || typeof resolvedChainId !== "number") {
      setStatus("idle");
      setInstance(undefined);
      setError(undefined);
      return;
    }

    const token = ++refreshToken.current;
    setStatus("loading");
    setInstance(undefined);
    setError(undefined);

    try {
      await handle.refresh({
        provider: resolvedProvider,
        chainId: resolvedChainId,
      });

      if (token !== refreshToken.current) {
        return;
      }

      const currentStatus = handle.status;
      setStatus(currentStatus);

      if (currentStatus === "ready") {
        setInstance(handle.instance);
        setError(undefined);
      } else if (currentStatus === "error") {
        setInstance(undefined);
        setError(handle.error);
      }
    } catch (err) {
      if (token !== refreshToken.current) {
        return;
      }
      setInstance(undefined);
      setStatus("error");
      setError(err as Error);
    }
  }, [resolvedProvider, resolvedChainId]);

  const refresh = useCallback(() => {
    void runRefresh();
  }, [runRefresh]);

  useEffect(() => {
    if (!isEnabled) {
      handleRef.current.abort();
      setStatus("idle");
      setInstance(undefined);
      setError(undefined);
      return;
    }
    void runRefresh();
  }, [isEnabled, runRefresh]);

  return { instance, status, error, refresh };
};

export const useFhevm = useFhevmInstance;

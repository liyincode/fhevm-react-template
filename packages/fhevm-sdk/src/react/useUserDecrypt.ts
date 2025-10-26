import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JsonRpcSigner, Eip1193Provider } from "ethers";
import { BrowserProvider } from "ethers";
import type { FhevmInstance } from "../fhevmTypes";
import { type FHEDecryptRequest, publicDecrypt, userDecrypt } from "../core/decryption";
import type { GenericStringStorage } from "../storage/GenericStringStorage";
import { GenericStringInMemoryStorage } from "../storage/GenericStringStorage";
import { useFhevmContext } from "./FhevmProvider";

type BaseSignerOptions = {
  signer?: JsonRpcSigner;
  getSigner?: () => Promise<JsonRpcSigner>;
};

const useSharedSigner = (
  provider: Eip1193Provider | string | undefined,
  options: BaseSignerOptions
) => {
  const { signer, getSigner } = options;
  const [derivedSigner, setDerivedSigner] = useState<JsonRpcSigner | undefined>(signer);

  useEffect(() => {
    let cancelled = false;

    if (signer) {
      setDerivedSigner(signer);
      return () => {
        cancelled = true;
      };
    }

    const resolveSigner = async () => {
      try {
        if (getSigner) {
          const custom = await getSigner();
          if (!cancelled) {
            setDerivedSigner(custom);
          }
          return;
        }
        if (provider && typeof provider !== "string") {
          const browserProvider = new BrowserProvider(provider);
          const resolved = await browserProvider.getSigner();
          if (!cancelled) {
            setDerivedSigner(resolved);
          }
          return;
        }
        if (!cancelled) {
          setDerivedSigner(undefined);
        }
      } catch {
        if (!cancelled) {
          setDerivedSigner(undefined);
        }
      }
    };

    void resolveSigner();

    return () => {
      cancelled = true;
    };
  }, [signer, getSigner, provider]);

  return derivedSigner;
};

const createPrefixedStorage = (
  storage: GenericStringStorage | undefined,
  cacheKey: string | undefined
): GenericStringStorage => {
  if (!storage) {
    return new GenericStringInMemoryStorage();
  }
  if (!cacheKey) {
    return storage;
  }
  return {
    getItem(key: string) {
      return storage.getItem(`${cacheKey}:${key}`);
    },
    setItem(key: string, value: string) {
      return storage.setItem(`${cacheKey}:${key}`, value);
    },
    removeItem(key: string) {
      return storage.removeItem(`${cacheKey}:${key}`);
    },
  };
};

export type UseUserDecryptOptions = BaseSignerOptions & {
  instance?: FhevmInstance;
  requests?: readonly FHEDecryptRequest[];
  storage?: GenericStringStorage;
  cacheKey?: string;
  keyPair?: { publicKey: string; privateKey: string };
};

export type UseUserDecryptResult = {
  decrypt: () => Promise<void>;
  canDecrypt: boolean;
  data: Record<string, string | bigint | boolean>;
  isDecrypting: boolean;
  error?: string;
};

export const useUserDecrypt = (options: UseUserDecryptOptions): UseUserDecryptResult => {
  const { provider: contextProvider, signatureStorage } = useFhevmContext();
  const { instance, requests, cacheKey, keyPair, storage } = options;

  const effectiveStorage = useMemo(
    () => createPrefixedStorage(storage ?? signatureStorage, cacheKey),
    [storage, signatureStorage, cacheKey]
  );

  const signer = useSharedSigner(contextProvider, options);

  const [data, setData] = useState<Record<string, string | bigint | boolean>>({});
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const requestFingerprint = useMemo(() => {
    if (!requests || requests.length === 0) return "";
    return JSON.stringify(
      [...requests].map(r => ({ handle: r.handle, contractAddress: r.contractAddress })).sort((a, b) =>
        (a.handle + a.contractAddress).localeCompare(b.handle + b.contractAddress)
      )
    );
  }, [requests]);

  const pendingRef = useRef(0);

  const canDecrypt = useMemo(
    () => Boolean(instance && signer && requests && requests.length > 0 && !isDecrypting),
    [instance, signer, requests, isDecrypting]
  );

  const decrypt = useCallback(async () => {
    if (!instance || !signer || !requests || requests.length === 0) {
      return;
    }

    const token = ++pendingRef.current;
    setIsDecrypting(true);
    setError(undefined);

    try {
      const { result } = await userDecrypt({
        instance,
        signer,
        requests,
        storage: effectiveStorage,
        keyPair,
      });

      if (pendingRef.current !== token) {
        return;
      }

      setData(result);
      setError(undefined);
    } catch (err) {
      if (pendingRef.current !== token) {
        return;
      }
      const message =
        err instanceof Error
          ? `${err.name ?? "Error"}: ${err.message}`
          : `Unknown error: ${String(err)}`;
      setError(message);
    } finally {
      if (pendingRef.current === token) {
        setIsDecrypting(false);
      }
    }
  }, [instance, signer, requests, effectiveStorage, keyPair]);

  return {
    decrypt,
    canDecrypt,
    data,
    isDecrypting,
    error,
  };
};

export type UsePublicDecryptOptions = {
  instance?: FhevmInstance;
  requests?: readonly FHEDecryptRequest[];
  enabled?: boolean;
};

export type UsePublicDecryptResult = {
  data?: unknown;
  status: "idle" | "loading" | "success" | "error";
  error?: string;
  refetch: () => Promise<void>;
};

export const usePublicDecrypt = (options: UsePublicDecryptOptions): UsePublicDecryptResult => {
  const { instance, requests, enabled = true } = options;
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [data, setData] = useState<unknown>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const requestKey = useMemo(() => JSON.stringify(requests ?? []), [requests]);

  const execute = useCallback(async () => {
    if (!instance || !requests || requests.length === 0) {
      setStatus("idle");
      setData(undefined);
      setError(undefined);
      return;
    }

    setStatus("loading");
    setError(undefined);

    try {
      const { result } = await publicDecrypt({ instance, requests });
      setData(result);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [instance, requests]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void execute();
  }, [enabled, execute, requestKey]);

  return {
    data,
    status,
    error,
    refetch: execute,
  };
};

export type { FHEDecryptRequest } from "../core/decryption";

export const useFHEDecrypt = useUserDecrypt;

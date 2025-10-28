import {
  computed,
  isRef,
  readonly,
  ref,
  shallowRef,
  watch,
  type Ref,
} from "vue";
import type { JsonRpcSigner, Eip1193Provider } from "ethers";
import { BrowserProvider } from "ethers";
import type { FhevmInstance } from "../../shared/types/fhevmTypes";
import { userDecrypt, publicDecrypt, type FHEDecryptRequest } from "../../core/crypto/decryption";
import type { GenericStringStorage } from "../../shared/storage/GenericStringStorage";
import { GenericStringInMemoryStorage } from "../../shared/storage/GenericStringStorage";
import { useFhevmContext } from "./plugin";

type ProviderLike = Eip1193Provider | string;

type MaybeRefOrGetter<T> = T | Ref<T> | (() => T);

// Allow composables to accept raw values, refs or getter functions interchangeably.
const resolveMaybe = <T>(value: MaybeRefOrGetter<T> | undefined): T | undefined => {
  if (typeof value === "function") {
    return (value as () => T)();
  }
  if (isRef(value)) {
    return value.value;
  }
  return value;
};

// Prefer injected provider but gracefully fall back to global EIP-1193 if present.
const resolveProvider = (
  contextProvider: ProviderLike | undefined,
  defaultProvider?: () => ProviderLike | undefined,
) => {
  if (contextProvider !== undefined) return contextProvider;
  const fallback = defaultProvider?.();
  if (fallback !== undefined) return fallback;
  if (typeof window !== "undefined") {
    return (window as { ethereum?: ProviderLike }).ethereum;
  }
  return undefined;
};

// Namespaces cached signatures per composable consumer (e.g. per component).
const createPrefixedStorage = (
  storage: GenericStringStorage | undefined,
  cacheKey: string | undefined,
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

export type UseUserDecryptOptions = {
  instance?: MaybeRefOrGetter<FhevmInstance | undefined>;
  requests?: MaybeRefOrGetter<readonly FHEDecryptRequest[] | undefined>;
  storage?: MaybeRefOrGetter<GenericStringStorage | undefined>;
  cacheKey?: MaybeRefOrGetter<string | undefined>;
  signer?: MaybeRefOrGetter<JsonRpcSigner | undefined>;
  getSigner?: () => Promise<JsonRpcSigner>;
  keyPair?: MaybeRefOrGetter<{ publicKey: string; privateKey: string } | undefined>;
};

export type UseUserDecryptResult = {
  decrypt: () => Promise<void>;
  canDecrypt: Readonly<Ref<boolean>>;
  data: Readonly<Ref<Record<string, string | bigint | boolean>>>;
  isDecrypting: Readonly<Ref<boolean>>;
  error: Readonly<Ref<string | undefined>>;
};

// Lazily derive a signer from explicit prop, custom getter, or provider.getSigner().
const useDerivedSigner = (
  explicitSigner: MaybeRefOrGetter<JsonRpcSigner | undefined>,
  provider: () => ProviderLike | undefined,
  getSigner?: () => Promise<JsonRpcSigner>,
) => {
  const signerRef = shallowRef<JsonRpcSigner | undefined>(resolveMaybe(explicitSigner));
  let token = 0;

  // Whenever signer source or provider changes, recompute the signer safely.
  watch<[JsonRpcSigner | undefined, ProviderLike | undefined]>(
    () => [resolveMaybe(explicitSigner), provider()] as const,
    ([explicit, providerInstance], _prev, onCleanup) => {
      let cancelled = false;
      const currentToken = ++token;

      if (explicit) {
        signerRef.value = explicit;
        return;
      }

      signerRef.value = undefined;

      const run = async () => {
        try {
          if (getSigner) {
            const signer = await getSigner();
            if (!cancelled && token === currentToken) {
              signerRef.value = signer;
            }
            return;
          }
          if (providerInstance && typeof providerInstance !== "string") {
            const browserProvider = new BrowserProvider(providerInstance);
            const signer = await browserProvider.getSigner();
            if (!cancelled && token === currentToken) {
              signerRef.value = signer;
            }
          }
        } catch {
          if (!cancelled && token === currentToken) {
            signerRef.value = undefined;
          }
        }
      };

      if (getSigner || (providerInstance && typeof providerInstance !== "string")) {
        void run();
      }

      onCleanup(() => {
        cancelled = true;
      });
    },
    { immediate: true },
  );

  return signerRef;
};

export const useUserDecrypt = (options: UseUserDecryptOptions): UseUserDecryptResult => {
  const context = useFhevmContext();

  const provider = () => resolveProvider(context.provider, context.defaultProvider);

  const instanceRef = computed(() => resolveMaybe(options.instance));
  const requestsRef = computed(
    () => resolveMaybe(options.requests) ?? ([] as readonly FHEDecryptRequest[]),
  );
  const storageRef = computed(() => resolveMaybe(options.storage) ?? context.signatureStorage);
  const cacheKeyRef = computed(() => resolveMaybe(options.cacheKey));
  const keyPairRef = computed(() => resolveMaybe(options.keyPair));

  // Combine caller storage override with cache key prefixing.
  const effectiveStorageRef = computed(() =>
    createPrefixedStorage(storageRef.value, cacheKeyRef.value),
  );

  const signerRef = useDerivedSigner(options.signer, provider, options.getSigner);

  const data = ref<Record<string, string | bigint | boolean>>({});
  const isDecrypting = ref(false);
  const error = ref<string | undefined>(undefined);
  let pendingToken = 0;

  // Decrypt only when prerequisites are met and no request is in-flight.
  const canDecrypt = computed(
    () =>
      Boolean(
        instanceRef.value &&
          signerRef.value &&
          requestsRef.value.length > 0 &&
          !isDecrypting.value,
      ),
  );

  // Execute userDecrypt from core and surface structured state for the UI.
  const decrypt = async () => {
    const instance = instanceRef.value;
    const signer = signerRef.value;
    const requests = requestsRef.value;
    if (!instance || !signer || requests.length === 0) {
      return;
    }

    const currentToken = ++pendingToken;
    isDecrypting.value = true;
    error.value = undefined;

    try {
      const { result } = await userDecrypt({
        instance,
        signer,
        requests,
        storage: effectiveStorageRef.value,
        keyPair: keyPairRef.value,
      });

      if (pendingToken !== currentToken) {
        return;
      }

      data.value = result as Record<string, string | bigint | boolean>;
      error.value = undefined;
    } catch (err) {
      if (pendingToken !== currentToken) {
        return;
      }
      error.value =
        err instanceof Error ? `${err.name ?? "Error"}: ${err.message}` : String(err);
    } finally {
      if (pendingToken === currentToken) {
        isDecrypting.value = false;
      }
    }
  };

  return {
    decrypt,
    canDecrypt,
    data: readonly(data),
    isDecrypting: readonly(isDecrypting),
    error: readonly(error),
  };
};

export type UsePublicDecryptOptions = {
  instance?: MaybeRefOrGetter<FhevmInstance | undefined>;
  requests?: MaybeRefOrGetter<readonly FHEDecryptRequest[] | undefined>;
  enabled?: MaybeRefOrGetter<boolean>;
};

export type UsePublicDecryptResult = {
  data: Readonly<Ref<unknown>>;
  status: Readonly<Ref<"idle" | "loading" | "success" | "error">>;
  error: Readonly<Ref<string | undefined>>;
  refetch: () => Promise<void>;
};

export const usePublicDecrypt = (
  options: UsePublicDecryptOptions,
): UsePublicDecryptResult => {
  const instanceRef = computed(() => resolveMaybe(options.instance));
  const requestsRef = computed(
    () => resolveMaybe(options.requests) ?? ([] as readonly FHEDecryptRequest[]),
  );
  const enabledRef = computed(() => resolveMaybe(options.enabled) ?? true);

  const status = ref<"idle" | "loading" | "success" | "error">("idle");
  const data = ref<unknown>(undefined);
  const error = ref<string | undefined>(undefined);
  let currentKey = "";

  // Shared executor used by watch and refetch.
  const execute = async () => {
    const instance = instanceRef.value;
    const requests = requestsRef.value;

    if (!instance || requests.length === 0) {
      status.value = "idle";
      data.value = undefined;
      error.value = undefined;
      return;
    }

    status.value = "loading";
    error.value = undefined;

    try {
      const { result } = await publicDecrypt({ instance, requests });
      if (currentKey === JSON.stringify(requests)) {
        data.value = result;
        status.value = "success";
      }
    } catch (err) {
      status.value = "error";
      error.value = err instanceof Error ? err.message : String(err);
    }
  };

  // Auto-execute when instance/requests change and the hook is enabled.
  watch<[FhevmInstance | undefined, readonly FHEDecryptRequest[], boolean]>(
    [instanceRef, requestsRef, enabledRef],
    ([instance, requests, enabled]) => {
      if (!enabled) {
        return;
      }
      currentKey = JSON.stringify(requests);
      if (!instance || requests.length === 0) {
        status.value = "idle";
        data.value = undefined;
        error.value = undefined;
        return;
      }
      void execute();
    },
    { immediate: true },
  );

  const refetch = async () => {
    currentKey = JSON.stringify(requestsRef.value);
    await execute();
  };

  return {
    data: readonly(data),
    status: readonly(status),
    error: readonly(error),
    refetch,
  };
};

export const useFHEDecrypt = useUserDecrypt;

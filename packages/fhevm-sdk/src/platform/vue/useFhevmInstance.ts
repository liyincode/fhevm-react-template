import {
  computed,
  isRef,
  onBeforeUnmount,
  readonly,
  ref,
  shallowRef,
  watch,
  type Ref,
} from "vue";
import type { Eip1193Provider } from "ethers";
import type { FhevmInstance } from "../../shared/types/fhevmTypes";
import {
  createInstanceHandle,
  type FhevmInstanceHandle,
  type FhevmInstanceStatus,
} from "../../core/instance/handle";
import { resolveDefaultChainId } from "../../core/config";
import { useFhevmContext } from "./plugin";

type ProviderLike = Eip1193Provider | string;

type MaybeRefOrGetter<T> = T | Ref<T> | (() => T);

// Helper so callers can pass raw values, refs, or getter functions.
const resolveMaybe = <T>(value: MaybeRefOrGetter<T> | undefined): T | undefined => {
  if (typeof value === "function") {
    return (value as () => T)();
  }
  if (isRef(value)) {
    return value.value;
  }
  return value;
};

export type UseFhevmInstanceOptions = {
  provider?: MaybeRefOrGetter<ProviderLike | undefined>;
  chainId?: MaybeRefOrGetter<number | undefined>;
  enabled?: MaybeRefOrGetter<boolean>;
};

export type UseFhevmInstanceResult = {
  instance: Readonly<Ref<FhevmInstance | undefined>>;
  status: Readonly<Ref<FhevmInstanceStatus>>;
  error: Readonly<Ref<Error | undefined>>;
  refresh(): Promise<void>;
};

// Provider resolution follows explicit -> plugin provider -> plugin default -> window.ethereum.
const resolveProvider = (
  explicit: ProviderLike | undefined,
  contextProvider: ProviderLike | undefined,
  defaultProvider?: () => ProviderLike | undefined,
) => {
  if (explicit !== undefined) return explicit;
  if (contextProvider !== undefined) return contextProvider;
  const fallback = defaultProvider?.();
  if (fallback !== undefined) return fallback;
  if (typeof window !== "undefined") {
    return (window as { ethereum?: ProviderLike }).ethereum;
  }
  return undefined;
};

export const useFhevmInstance = (
  options: UseFhevmInstanceOptions = {},
): UseFhevmInstanceResult => {
  const context = useFhevmContext();

  // Track provider/chain/enabled reactively so refresh can re-run when any source changes.
  const providerRef = computed<ProviderLike | undefined>(() =>
    resolveProvider(
      resolveMaybe(options.provider),
      context.provider,
      context.defaultProvider,
    ),
  );

  const chainIdRef = computed<number | undefined>(() => {
    const explicit = resolveMaybe(options.chainId);
    if (typeof explicit === "number") return explicit;
    if (typeof context.chainId === "number") return context.chainId;
    try {
      return resolveDefaultChainId(undefined, context.config);
    } catch {
      return undefined;
    }
  });

  const enabledRef = computed<boolean>(() => {
    const explicit = resolveMaybe(options.enabled);
    return explicit ?? true;
  });

  // Instance handle is memoised and aborted before each refresh to avoid race conditions.
  const handleRef = shallowRef<FhevmInstanceHandle>(
    createInstanceHandle(context.config, {
      defaultProvider: () => providerRef.value ?? context.defaultProvider?.(),
    }),
  );

  const status = ref<FhevmInstanceStatus>("idle");
  const instance = shallowRef<FhevmInstance | undefined>(undefined);
  const error = ref<Error | undefined>(undefined);

  let refreshToken = 0;

  // Ensure only the latest invocation updates state even if older refreshes resolve later.
  const performRefresh = async (
    provider: ProviderLike | undefined,
    chainId: number | undefined,
    enabled: boolean,
  ) => {
    const handle = handleRef.value;
    handle.abort();

    if (!enabled || !provider || typeof chainId !== "number") {
      status.value = "idle";
      instance.value = undefined;
      error.value = undefined;
      return;
    }

    const currentToken = ++refreshToken;
    status.value = "loading";
    instance.value = undefined;
    error.value = undefined;

    try {
      await handle.refresh({
        provider,
        chainId,
      });

      if (currentToken !== refreshToken) {
        return;
      }

      status.value = handle.status;
      instance.value = handle.instance;
      error.value = handle.error;
    } catch (err) {
      if (currentToken !== refreshToken) {
        return;
      }
      status.value = "error";
      instance.value = undefined;
      error.value = err as Error;
    }
  };

  // Trigger refresh on first mount and whenever reactive dependencies change.
  watch<[ProviderLike | undefined, number | undefined, boolean]>(
    [providerRef, chainIdRef, enabledRef],
    ([provider, chainId, enabled]) => {
      void performRefresh(provider, chainId, enabled);
    },
    { immediate: true },
  );

  // Abort pending instance creation when the component is destroyed.
  onBeforeUnmount(() => {
    handleRef.value.abort();
  });

  const refresh = async () => {
    await performRefresh(providerRef.value, chainIdRef.value, enabledRef.value);
  };

  return {
    instance: readonly(instance),
    status: readonly(status),
    error: readonly(error),
    refresh,
  };
};

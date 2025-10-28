import {
  computed,
  isRef,
  readonly,
  ref,
  shallowRef,
  watch,
  type Ref,
} from "vue";
import type { RelayerEncryptedInput } from "@zama-fhe/relayer-sdk/bundle";
import type { JsonRpcSigner, Eip1193Provider } from "ethers";
import { BrowserProvider } from "ethers";
import type { FhevmInstance } from "../../shared/types/fhevmTypes";
import { encryptInput, type EncryptResult } from "../../core/crypto/encryption";
import { useFhevmContext } from "./plugin";

type MaybeRefOrGetter<T> = T | Ref<T> | (() => T);

// Normalise raw values, refs, and getters for ergonomic API usage.
const resolveMaybe = <T>(value: MaybeRefOrGetter<T> | undefined): T | undefined => {
  if (typeof value === "function") {
    return (value as () => T)();
  }
  if (isRef(value)) {
    return value.value;
  }
  return value;
};

type ProviderLike = Eip1193Provider | string;

// Prefer provider from plugin context, otherwise fall back to window.ethereum.
const resolveProvider = (
  contextProvider: ProviderLike | undefined,
  defaultProvider?: () => ProviderLike | undefined,
) => {
  if (contextProvider !== undefined) {
    return contextProvider;
  }
  if (defaultProvider) {
    return defaultProvider();
  }
  if (typeof window !== "undefined") {
    return (window as { ethereum?: ProviderLike }).ethereum;
  }
  return undefined;
};

export type UseEncryptedInputOptions = {
  instance?: MaybeRefOrGetter<FhevmInstance | undefined>;
  contractAddress?: MaybeRefOrGetter<`0x${string}` | undefined>;
  signer?: MaybeRefOrGetter<JsonRpcSigner | undefined>;
  getSigner?: () => Promise<JsonRpcSigner>;
};

export type UseEncryptedInputResult = {
  canEncrypt: Readonly<Ref<boolean>>;
  encrypt(build: (builder: RelayerEncryptedInput) => void): Promise<EncryptResult | undefined>;
  lastPayload: Readonly<Ref<EncryptResult | undefined>>;
};

export const useEncryptedInput = (options: UseEncryptedInputOptions): UseEncryptedInputResult => {
  const context = useFhevmContext();

  const instanceRef = computed(() => resolveMaybe(options.instance));
  const contractAddressRef = computed(() => resolveMaybe(options.contractAddress));
  const explicitSignerRef = computed(() => resolveMaybe(options.signer));

  // Provider/signers update reactively so we can re-compute capabilities.
  const providerRef = computed<ProviderLike | undefined>(() =>
    resolveProvider(context.provider, context.defaultProvider),
  );

  const derivedSigner = shallowRef<JsonRpcSigner | undefined>(explicitSignerRef.value);
  let signerToken = 0;

  // Keep the signer in sync with props or derived provider; only the latest run wins.
  watch<[JsonRpcSigner | undefined, ProviderLike | undefined]>(
    [explicitSignerRef, providerRef],
    ([explicitSigner, provider], _prev, onCleanup) => {
      let cancelled = false;
      const currentToken = ++signerToken;

      if (explicitSigner) {
        derivedSigner.value = explicitSigner;
        return;
      }

      derivedSigner.value = undefined;

      const run = async () => {
        try {
          if (options.getSigner) {
            const signer = await options.getSigner();
            if (!cancelled && signerToken === currentToken) {
              derivedSigner.value = signer;
            }
            return;
          }
          if (provider && typeof provider !== "string") {
            const browserProvider = new BrowserProvider(provider);
            const signer = await browserProvider.getSigner();
            if (!cancelled && signerToken === currentToken) {
              derivedSigner.value = signer;
            }
          }
        } catch {
          if (!cancelled && signerToken === currentToken) {
            derivedSigner.value = undefined;
          }
        }
      };

      if (options.getSigner || (provider && typeof provider !== "string")) {
        void run();
      }

      onCleanup(() => {
        cancelled = true;
      });
    },
    { immediate: true },
  );

  const lastPayload = ref<EncryptResult | undefined>(undefined);
  // Expose reactive flag so components can guard UI interactions.
  const canEncrypt = computed(
    () => Boolean(instanceRef.value && contractAddressRef.value && derivedSigner.value),
  );

  // Wrap core encryptInput and persist the latest payload for consumers.
  const encrypt = async (
    build: (builder: RelayerEncryptedInput) => void,
  ): Promise<EncryptResult | undefined> => {
    const instance = instanceRef.value;
    const contractAddress = contractAddressRef.value;
    const signer = derivedSigner.value;

    if (!instance || !contractAddress || !signer) {
      return undefined;
    }

    const userAddress = (await signer.getAddress()) as `0x${string}`;
    const payload = await encryptInput({
      instance,
      contractAddress,
      userAddress,
      build,
    });
    lastPayload.value = payload;
    return payload;
  };

  return {
    canEncrypt,
    encrypt,
    lastPayload: readonly(lastPayload),
  };
};

export const useFHEEncryption = useEncryptedInput;

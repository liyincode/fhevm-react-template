import { useCallback, useEffect, useMemo, useState } from "react";
import type { RelayerEncryptedInput } from "@zama-fhe/relayer-sdk/bundle";
import type { JsonRpcSigner, Eip1193Provider } from "ethers";
import { BrowserProvider } from "ethers";
import type { FhevmInstance } from "../fhevmTypes";
import { encryptInput, type EncryptResult } from "../core/encryption";
import { useFhevmContext } from "./FhevmProvider";

type UseEncryptedInputOptions = {
  instance?: FhevmInstance;
  contractAddress?: `0x${string}`;
  signer?: JsonRpcSigner;
  getSigner?: () => Promise<JsonRpcSigner>;
};

type UseEncryptedInputResult = {
  canEncrypt: boolean;
  encrypt: (build: (builder: RelayerEncryptedInput) => void) => Promise<EncryptResult | undefined>;
  lastPayload?: EncryptResult;
};

const useDerivedSigner = (
  explicitSigner: JsonRpcSigner | undefined,
  provider: Eip1193Provider | string | undefined,
  getSigner?: () => Promise<JsonRpcSigner>
) => {
  const [signer, setSigner] = useState<JsonRpcSigner | undefined>(explicitSigner);

  useEffect(() => {
    let cancelled = false;

    if (explicitSigner) {
      setSigner(explicitSigner);
      return () => {
        cancelled = true;
      };
    }

    const resolveSigner = async () => {
      try {
        if (getSigner) {
          const custom = await getSigner();
          if (!cancelled) {
            setSigner(custom);
          }
          return;
        }
        if (provider && typeof provider !== "string") {
          const browserProvider = new BrowserProvider(provider);
          const resolved = await browserProvider.getSigner();
          if (!cancelled) {
            setSigner(resolved);
          }
          return;
        }
        if (!cancelled) {
          setSigner(undefined);
        }
      } catch {
        if (!cancelled) {
          setSigner(undefined);
        }
      }
    };

    void resolveSigner();

    return () => {
      cancelled = true;
    };
  }, [explicitSigner, provider, getSigner]);

  return signer;
};

export const useEncryptedInput = (options: UseEncryptedInputOptions): UseEncryptedInputResult => {
  const { provider: contextProvider } = useFhevmContext();
  const { instance, contractAddress, signer, getSigner } = options;

  const derivedSigner = useDerivedSigner(signer, contextProvider, getSigner);
  const [lastPayload, setLastPayload] = useState<EncryptResult | undefined>(undefined);

  const canEncrypt = useMemo(
    () => Boolean(instance && contractAddress && derivedSigner),
    [instance, contractAddress, derivedSigner]
  );

  const encrypt = useCallback(
    async (build: (builder: RelayerEncryptedInput) => void): Promise<EncryptResult | undefined> => {
      if (!instance || !contractAddress || !derivedSigner) {
        return undefined;
      }

      const userAddress = (await derivedSigner.getAddress()) as `0x${string}`;
      const payload = await encryptInput({
        instance,
        contractAddress,
        userAddress,
        build,
      });

      setLastPayload(payload);
      return payload;
    },
    [instance, contractAddress, derivedSigner]
  );

  return {
    canEncrypt,
    encrypt,
    lastPayload,
  };
};

export const useFHEEncryption = useEncryptedInput;

import type { JsonRpcSigner, Signer } from "ethers";
import type { GenericStringStorage } from "../../shared/storage/GenericStringStorage";
import type { FhevmInstance } from "../../shared/types/fhevmTypes";
import { FhevmDecryptionSignature } from "../../shared/signature/FhevmDecryptionSignature";

export type FHEDecryptRequest = { handle: string; contractAddress: `0x${string}` };

export type UserDecryptParams = {
  instance: FhevmInstance;
  signer: Signer | JsonRpcSigner;
  requests: readonly FHEDecryptRequest[];
  storage: GenericStringStorage;
  chainId?: number;
  keyPair?: { publicKey: string; privateKey: string };
};

export const userDecrypt = async (params: UserDecryptParams) => {
  const { instance, signer, requests, storage, keyPair } = params;

  const uniqueAddresses = Array.from(new Set(requests.map(r => r.contractAddress)));
  const sig = await FhevmDecryptionSignature.loadOrSign(
    instance,
    uniqueAddresses,
    signer,
    storage,
    keyPair,
  );

  if (!sig) {
    throw new Error("Failed to create FHE decryption signature");
  }

  const mutableReqs = requests.map(r => ({ handle: r.handle, contractAddress: r.contractAddress }));
  const result = await instance.userDecrypt(
    mutableReqs,
    sig.privateKey,
    sig.publicKey,
    sig.signature,
    sig.contractAddresses,
    sig.userAddress,
    sig.startTimestamp,
    sig.durationDays,
  );

  return { result, signature: sig } as const;
};

export type PublicDecryptParams = {
  instance: FhevmInstance;
  requests: readonly FHEDecryptRequest[];
};

export const publicDecrypt = async (params: PublicDecryptParams) => {
  const { instance, requests } = params;

  if (!Array.isArray(requests) || requests.length === 0) {
    throw new Error("publicDecrypt: requests array is empty");
  }

  if (typeof (instance as any).decrypt !== "function") {
    throw new Error(
      "publicDecrypt: FhevmInstance does not support public decryption. Ensure the injected relayer adapter exposes decrypt()."
    );
  }

  const mutableReqs = requests.map(r => ({
    handle: r.handle,
    contractAddress: r.contractAddress,
  }));

  try {
    const result = await (instance as any).decrypt(mutableReqs);
    return { result } as const;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`publicDecrypt failed: ${error.message}`);
    }
    throw new Error(`publicDecrypt failed: ${String(error)}`);
  }
};

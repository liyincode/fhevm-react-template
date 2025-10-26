import { useFhevmContext } from "./FhevmProvider";
import type { PublicKeyStore } from "../core/config";
import type { GenericStringStorage } from "../storage/GenericStringStorage";

export const usePublicKeyStore = (): PublicKeyStore => {
  const { publicKeyStore } = useFhevmContext();
  return publicKeyStore;
};

export const useSignatureStorage = (): GenericStringStorage | undefined => {
  const { signatureStorage } = useFhevmContext();
  return signatureStorage;
};

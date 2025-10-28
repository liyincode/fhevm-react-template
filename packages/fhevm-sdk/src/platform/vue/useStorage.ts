import { useFhevmContext } from "./plugin";
import type { PublicKeyStore } from "../../core/config";
import type { GenericStringStorage } from "../../shared/storage/GenericStringStorage";

// Provide direct access to the configured public key store for advanced scenarios.
export const usePublicKeyStore = (): PublicKeyStore => {
  const { publicKeyStore } = useFhevmContext();
  return publicKeyStore;
};

// Consumers can optionally access the signature storage used by userDecrypt.
export const useSignatureStorage = (): GenericStringStorage | undefined => {
  const { signatureStorage } = useFhevmContext();
  return signatureStorage;
};

import type { CreateInstanceOptions } from "./createInstance";
import { createConfiguredFhevmInstance } from "./createInstance";
import { createInstanceHandle, type CreateInstanceHandleOptions } from "./handle";
import type { FhevmConfig } from "../config";
import type { FhevmInstance } from "../../shared/types/fhevmTypes";
import type { EncryptResult } from "../crypto/encryption";
import { encryptInput, getEncryptionMethod, toHex, buildParamsFromAbi } from "../crypto/encryption";
import { publicDecrypt, userDecrypt } from "../crypto/decryption";

export type FhevmClient = {
  config: FhevmConfig;
  handle: ReturnType<typeof createInstanceHandle>;
  createInstance(options: CreateInstanceOptions): Promise<FhevmInstance>;
  encryptInput: typeof encryptInput;
  getEncryptionMethod: typeof getEncryptionMethod;
  toHex: typeof toHex;
  buildParamsFromAbi: typeof buildParamsFromAbi;
  userDecrypt: typeof userDecrypt;
  publicDecrypt: typeof publicDecrypt;
};

export type CreateFhevmClientOptions = Pick<CreateInstanceHandleOptions, "defaultProvider">;

export const createFhevmClient = (config: FhevmConfig, options?: CreateFhevmClientOptions): FhevmClient => {
  const handle = createInstanceHandle(config, { defaultProvider: options?.defaultProvider });

  const createInstance = async (options: CreateInstanceOptions): Promise<FhevmInstance> => {
    const result = await createConfiguredFhevmInstance(config, options);
    return result.instance;
  };

  return {
    config,
    handle,
    createInstance,
    encryptInput,
    getEncryptionMethod,
    toHex,
    buildParamsFromAbi,
    userDecrypt,
    publicDecrypt,
  };
};

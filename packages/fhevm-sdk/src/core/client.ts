import type { CreateInstanceOptions } from "./instance";
import { createConfiguredFhevmInstance } from "./instance";
import { createInstanceHandle } from "./instanceHandle";
import type { FhevmConfig } from "./config";
import type { FhevmInstance } from "../fhevmTypes";
import type { EncryptResult } from "./encryption";
import { encryptInput, getEncryptionMethod, toHex, buildParamsFromAbi } from "./encryption";
import { publicDecrypt, userDecrypt } from "./decryption";

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

export const createFhevmClient = (config: FhevmConfig): FhevmClient => {
  const handle = createInstanceHandle(config);

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

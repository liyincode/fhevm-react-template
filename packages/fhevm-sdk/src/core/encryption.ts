import type { RelayerEncryptedInput } from "@zama-fhe/relayer-sdk/bundle";
import type { FhevmInstance } from "../fhevmTypes";

export type EncryptResult = {
  handles: Uint8Array[];
  inputProof: Uint8Array;
};

export const encryptInput = async (params: {
  instance: FhevmInstance;
  contractAddress: `0x${string}`;
  userAddress: `0x${string}`;
  build: (builder: RelayerEncryptedInput) => void;
}): Promise<EncryptResult> => {
  const { instance, contractAddress, userAddress, build } = params;
  const input = instance.createEncryptedInput(contractAddress, userAddress) as RelayerEncryptedInput;
  build(input);
  const enc = await input.encrypt();
  return enc;
};

// Map external encrypted integer type to RelayerEncryptedInput builder method
export const getEncryptionMethod = (internalType: string) => {
  switch (internalType) {
    case "externalEbool":
      return "addBool" as const;
    case "externalEuint8":
      return "add8" as const;
    case "externalEuint16":
      return "add16" as const;
    case "externalEuint32":
      return "add32" as const;
    case "externalEuint64":
      return "add64" as const;
    case "externalEuint128":
      return "add128" as const;
    case "externalEuint256":
      return "add256" as const;
    case "externalEaddress":
      return "addAddress" as const;
    default:
      console.warn(`Unknown internalType: ${internalType}, defaulting to add64`);
      return "add64" as const;
  }
};

// Convert Uint8Array or hex-like string to 0x-prefixed hex string
export const toHex = (value: Uint8Array | string): `0x${string}` => {
  if (typeof value === "string") {
    return (value.startsWith("0x") ? value : `0x${value}`) as `0x${string}`;
  }
  if (value.length === 0) {
    return "0x";
  }
  let hex = "";
  for (const byte of value) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return `0x${hex}` as `0x${string}`;
};

// Build contract params from EncryptResult and ABI for a given function
type AbiInput = {
  type: string;
  name?: string;
  internalType?: string;
};

const isProofParameter = (input: AbiInput): boolean => {
  const name = input.name?.toLowerCase() ?? "";
  const internalType = input.internalType?.toLowerCase() ?? "";
  if (name.includes("proof")) return true;
  if (internalType.includes("proof")) return true;
  return false;
};

const coerceUintToBigInt = (raw: Uint8Array | string): bigint => {
  const hex = toHex(raw);
  return BigInt(hex);
};

const coerceBool = (raw: Uint8Array | string): boolean => {
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "0x" || normalized === "0x0" || normalized === "0") return false;
    return normalized !== "" && normalized !== "false";
  }
  for (const value of raw) {
    if (value !== 0) return true;
  }
  return false;
};

const coerceAddressOrString = (raw: Uint8Array | string): string => {
  if (typeof raw === "string") {
    return raw.startsWith("0x") ? raw : `0x${raw}`;
  }
  return toHex(raw);
};

export const buildParamsFromAbi = (enc: EncryptResult, abi: any[], functionName: string): any[] => {
  const fn = abi.find((item: any) => item.type === "function" && item.name === functionName);
  if (!fn) throw new Error(`Function ABI not found for ${functionName}`);
  if (!Array.isArray(fn.inputs) || fn.inputs.length === 0) {
    return [];
  }

  let handleIndex = 0;
  let proofConsumed = false;
  return fn.inputs.map((input: AbiInput, index: number) => {
    const useProof = isProofParameter(input);
    let raw: Uint8Array | string;

    if (useProof) {
      if (!enc.inputProof) {
        throw new Error(`buildParamsFromAbi: missing inputProof for parameter ${input.name ?? `#${index}`}`);
      }
      raw = enc.inputProof;
      proofConsumed = true;
    } else {
      const handle = enc.handles[handleIndex];
      if (handle) {
        raw = handle;
        handleIndex += 1;
      } else if (!proofConsumed && enc.inputProof) {
        raw = enc.inputProof;
        proofConsumed = true;
      } else {
        throw new Error(
          `buildParamsFromAbi: not enough encrypted handles for parameter ${input.name ?? `#${index}`}`
        );
      }
    }

    const type = input.type;
    if (!type) {
      console.warn(`Unknown ABI param type; passing as hex`);
      return toHex(raw);
    }

    if (type === "bool") {
      return coerceBool(raw);
    }
    if (type === "address" || type === "string") {
      return coerceAddressOrString(raw);
    }
    if (type.startsWith("uint") || type === "int256" || type.startsWith("int")) {
      return coerceUintToBigInt(raw);
    }
    if (type.startsWith("bytes")) {
      return toHex(raw);
    }

    console.warn(`Unknown ABI param type ${type}; passing as hex`);
    return toHex(raw);
  });
};

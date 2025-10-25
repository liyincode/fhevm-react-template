import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { publicKeyStorageGet, publicKeyStorageSet } from "../../internal/PublicKeyStorage";
import type { PublicKeyRecord, PublicKeyStore } from "../config";

const DB_NAME = "fhevm";
const PUBLIC_KEY_STORE = "publicKeyStore";
const PARAMS_STORE = "paramsStore";

interface PublicParamsDB extends DBSchema {
  publicKeyStore: {
    key: `0x${string}`;
    value: unknown;
  };
  paramsStore: {
    key: `0x${string}`;
    value: unknown;
  };
}

let dbPromise: Promise<IDBPDatabase<PublicParamsDB>> | undefined;

const getDb = async (): Promise<IDBPDatabase<PublicParamsDB> | undefined> => {
  if (dbPromise) return dbPromise;
  if (typeof window === "undefined") return undefined;

  dbPromise = openDB<PublicParamsDB>(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(PARAMS_STORE)) {
        db.createObjectStore(PARAMS_STORE, { keyPath: "acl" });
      }
      if (!db.objectStoreNames.contains(PUBLIC_KEY_STORE)) {
        db.createObjectStore(PUBLIC_KEY_STORE, { keyPath: "acl" });
      }
    },
  });

  return dbPromise;
};

const pickPublicParams = (record: PublicKeyRecord | null | undefined) => {
  if (!record?.publicParams) return null;
  const { publicParams } = record;
  if (publicParams["2048"]) {
    return publicParams["2048"];
  }
  const firstEntry = Object.values(publicParams)[0];
  if (!firstEntry) return null;
  return firstEntry;
};

export const createIndexedDbPublicKeyStore = (): PublicKeyStore => ({
  async get(aclAddress: `0x${string}`) {
    const value = await publicKeyStorageGet(aclAddress);
    if (!value.publicKey && !value.publicParams) {
      return null;
    }
    return value as PublicKeyRecord;
  },

  async set(aclAddress: `0x${string}`, value: PublicKeyRecord) {
    const storedPublicKey = value.publicKey && value.publicKey.id && value.publicKey.data
      ? { publicKeyId: value.publicKey.id, publicKey: value.publicKey.data }
      : null;

    const params = pickPublicParams(value);
    const storedParams = params
      ? { publicParamsId: params.publicParamsId, publicParams: params.publicParams }
      : null;

    await publicKeyStorageSet(aclAddress, storedPublicKey as any, storedParams as any);
  },

  async delete(aclAddress: `0x${string}`) {
    const db = await getDb();
    if (!db) return;
    await db.delete(PUBLIC_KEY_STORE, aclAddress);
    await db.delete(PARAMS_STORE, aclAddress);
  },
});

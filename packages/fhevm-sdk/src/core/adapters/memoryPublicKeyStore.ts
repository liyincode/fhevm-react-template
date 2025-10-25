import type { PublicKeyRecord, PublicKeyStore } from "../config";

export const createMemoryPublicKeyStore = (): PublicKeyStore => {
  const store = new Map<`0x${string}`, PublicKeyRecord>();

  return {
    async get(acl) {
      return store.get(acl) ?? null;
    },
    async set(acl, value) {
      store.set(acl, value);
    },
    async delete(acl) {
      store.delete(acl);
    },
  };
};

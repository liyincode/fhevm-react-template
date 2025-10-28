import fs from "node:fs/promises";
import path from "node:path";
import type { PublicKeyRecord, PublicKeyStore } from "../../core/config";

export const createFilePublicKeyStore = (directory: string): PublicKeyStore => {
  const resolvePath = (acl: `0x${string}`) => path.join(directory, `${acl}.json`);

  return {
    async get(acl) {
      try {
        const file = resolvePath(acl);
        const data = await fs.readFile(file, "utf-8");
        return JSON.parse(data) as PublicKeyRecord;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async set(acl, value) {
      await fs.mkdir(directory, { recursive: true });
      const file = resolvePath(acl);
      await fs.writeFile(file, JSON.stringify(value));
    },
    async delete(acl) {
      try {
        await fs.unlink(resolvePath(acl));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    },
  };
};

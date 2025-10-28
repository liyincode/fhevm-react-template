import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createFilePublicKeyStore } from "../../src/platform/node/filePublicKeyStore";

const aclAddress = "0x1111111111111111111111111111111111111111" as const;

const makeRecords = () => ({
  publicKey: {
    id: "pk1",
    data: new Uint8Array([1, 2, 3]),
  },
  publicParams: {
    "2048": {
      publicParamsId: "params1",
      publicParams: new Uint8Array([4, 5, 6]),
    },
  },
});

describe("createFilePublicKeyStore", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(process.cwd(), "tmp-fhevm-store-"));
  });

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  it("returns null when key is missing", async () => {
    const store = createFilePublicKeyStore(directory);
    const value = await store.get(aclAddress);
    expect(value).toBeNull();
  });

  it("persists and retrieves a record", async () => {
    const store = createFilePublicKeyStore(directory);
    const record = makeRecords();

    await store.set(aclAddress, record);

    const file = path.join(directory, `${aclAddress}.json`);
    const disk = JSON.parse(await fs.readFile(file, "utf-8"));
    expect(disk.publicKey.id).toBe("pk1");

    const loaded = await store.get(aclAddress);
    expect(loaded?.publicKey?.id).toBe("pk1");
    expect(loaded?.publicParams?.["2048"]?.publicParamsId).toBe("params1");
  });

  it("overwrites existing values", async () => {
    const store = createFilePublicKeyStore(directory);
    await store.set(aclAddress, makeRecords());

    const updated = {
      publicKey: {
        id: "pk2",
        data: new Uint8Array([9, 9, 9]),
      },
    };

    await store.set(aclAddress, updated);
    const loaded = await store.get(aclAddress);
    expect(loaded?.publicKey?.id).toBe("pk2");
    expect(loaded?.publicParams).toBeUndefined();
  });

  it("deletes files when requested", async () => {
    const store = createFilePublicKeyStore(directory);
    await store.set(aclAddress, makeRecords());
    await store.delete(aclAddress);

    const file = path.join(directory, `${aclAddress}.json`);
    await expect(fs.access(file)).rejects.toThrow();
    const loaded = await store.get(aclAddress);
    expect(loaded).toBeNull();
  });

  it("ignores ENOENT on delete", async () => {
    const store = createFilePublicKeyStore(directory);
    await expect(store.delete(aclAddress)).resolves.not.toThrow();
  });

  it("rethrows unexpected fs errors", async () => {
    const store = createFilePublicKeyStore(directory);
    const writeSpy = vi.spyOn(fs, "writeFile").mockRejectedValue(Object.assign(new Error("boom"), { code: "EPERM" }));

    await expect(store.set(aclAddress, makeRecords())).rejects.toThrow("boom");
    writeSpy.mockRestore();
  });
});

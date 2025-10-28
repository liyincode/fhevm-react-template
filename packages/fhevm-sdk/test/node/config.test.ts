import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createNoopRelayerClient } from "../../src/core/adapters/relayer/noop";
import { createMemoryPublicKeyStore } from "../../src/core/adapters/storage/memory";
import type { PublicKeyStore, RelayerClientAdapter } from "../../src/core/config";
import { createNodeFhevmConfig } from "../../src/platform/node/config";

describe("createNodeFhevmConfig", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(process.cwd(), "tmp-node-config-"));
  });

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  it("uses supplied relayer and public key store", () => {
    const relayerClient: RelayerClientAdapter = createNoopRelayerClient("custom");
    const publicKeyStore: PublicKeyStore = createMemoryPublicKeyStore();

    const config = createNodeFhevmConfig({
      chains: [{ id: 1, name: "Local" }],
      directory,
      relayerClient,
      publicKeyStore,
      configOverrides: {
        defaultChainId: 1,
      },
    });

    expect(config.relayerClient).toBe(relayerClient);
    expect(config.publicKeyStore).toBe(publicKeyStore);
    expect(config.defaultChainId).toBe(1);
  });

  it("falls back to file store when no public key store provided", async () => {
    const config = createNodeFhevmConfig({
      chains: [{ id: 2, name: "Another" }],
      directory,
    });

    // Write a sentinel value and confirm the injected store can read it.
    const sample = {
      publicKey: { id: "pk", data: new Uint8Array([1]) },
    };

    await config.publicKeyStore.set("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", sample);
    const loaded = await config.publicKeyStore.get("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(loaded?.publicKey?.id).toBe("pk");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const createConfiguredFhevmInstance = vi.fn();

vi.mock("../../src/core/instance/createInstance", () => ({
  createConfiguredFhevmInstance,
}));

const { createInstanceHandle } = await import("../../src/core/instance/handle");
const { createFhevmConfig } = await import("../../src/core/config");
const { createNoopRelayerClient } = await import("../../src/core/adapters/relayer/noop");
const { createMemoryPublicKeyStore } = await import("../../src/core/adapters/storage/memory");

const makeConfig = () =>
  createFhevmConfig({
    chains: [{ id: 1, name: "Testnet" }],
    relayerClient: createNoopRelayerClient(),
    publicKeyStore: createMemoryPublicKeyStore(),
  });

describe("createInstanceHandle", () => {
  beforeEach(() => {
    createConfiguredFhevmInstance.mockReset();
  });

  it("transitions to ready state on successful refresh", async () => {
    const instanceObject = { marker: "instance" };
    createConfiguredFhevmInstance.mockResolvedValue({
      instance: instanceObject,
      chainId: 1,
      abort: vi.fn(),
    });

    const handle = createInstanceHandle(makeConfig());
    expect(handle.status).toBe("idle");

    await handle.refresh({ provider: {} });

    expect(createConfiguredFhevmInstance).toHaveBeenCalled();
    expect(handle.status).toBe("ready");
    expect(handle.instance).toBe(instanceObject);
    expect(handle.error).toBeUndefined();
  });

  it("moves to error state when refresh fails", async () => {
    createConfiguredFhevmInstance.mockRejectedValue(new Error("failure"));

    const handle = createInstanceHandle(makeConfig());
    await handle.refresh({ provider: {} });

    expect(handle.status).toBe("error");
    expect(handle.instance).toBeUndefined();
    expect(handle.error).toBeInstanceOf(Error);
  });

  it("returns to idle when refresh is aborted", async () => {
    createConfiguredFhevmInstance.mockImplementation((_config, options) => {
      return new Promise((resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        setTimeout(() => resolve({ instance: {}, chainId: 1, abort: vi.fn() }), 50);
      });
    });

    const handle = createInstanceHandle(makeConfig());
    const refreshPromise = handle.refresh({ provider: {} });
    handle.abort();

    await refreshPromise.catch(() => {});

    expect(handle.status).toBe("idle");
    expect(handle.instance).toBeUndefined();
  });

  it("uses provided default provider when none is passed", async () => {
    const instanceObject = { marker: "instance" };
    createConfiguredFhevmInstance.mockResolvedValue({
      instance: instanceObject,
      chainId: 1,
      abort: vi.fn(),
    });

    const defaultProvider = { provider: true };
    const handle = createInstanceHandle(makeConfig(), {
      defaultProvider: () => defaultProvider,
    });

    await handle.refresh();

    expect(createConfiguredFhevmInstance).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ provider: defaultProvider }),
    );
    expect(handle.instance).toBe(instanceObject);
  });
});

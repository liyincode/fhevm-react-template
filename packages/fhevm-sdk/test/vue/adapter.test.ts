import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Eip1193Provider, JsonRpcSigner } from "ethers";
import { createApp, defineComponent, nextTick } from "vue";
import { createFhevmConfig } from "../../src/core/config";
import { createNoopRelayerClient } from "../../src/core/adapters/relayer/noop";
import { createMemoryPublicKeyStore } from "../../src/core/adapters/storage/memory";
import {
  createFhevmVuePlugin,
  useFhevmContext,
  useFhevmInstance,
  useEncryptedInput,
} from "../../src/platform/vue";



const configuredInstanceMock = vi.fn();

vi.mock("../../src/core/instance/createInstance", async actual => {
  const module = await actual();
  return {
    ...module,
    createConfiguredFhevmInstance: (...args: any[]) => configuredInstanceMock(...args),
  };
});

const makeConfig = () =>
  createFhevmConfig({
    chains: [{ id: 1, name: "Local" }],
    relayerClient: createNoopRelayerClient(),
    publicKeyStore: createMemoryPublicKeyStore(),
  });

describe("Vue adapter", () => {
  beforeEach(() => {
    configuredInstanceMock.mockReset();
  });

  it("provides context via plugin", async () => {
    const config = makeConfig();
    const plugin = createFhevmVuePlugin({ config });

    let contextConfig: typeof config | undefined;
    const TestComponent = defineComponent({
      setup() {
        const context = useFhevmContext();
        contextConfig = context.config;
        return () => null;
      },
    });

    const app = createApp(TestComponent);
    app.use(plugin);
    const container = document.createElement("div");
    app.mount(container);

    await nextTick();
    expect(contextConfig).toBe(config);

    app.unmount();
  });

  it("loads instance through useFhevmInstance", async () => {
    const config = makeConfig();
    const plugin = createFhevmVuePlugin({ config });
    const mockInstance = { marker: "ok" };

    configuredInstanceMock.mockResolvedValue({
      instance: mockInstance,
      chainId: 1,
      abort: vi.fn(),
    });

    const provider = { request: vi.fn() } as unknown as Eip1193Provider;

    let exposure:
      | ReturnType<typeof useFhevmInstance>
      | undefined;

    const TestComponent = defineComponent({
      setup() {
        exposure = useFhevmInstance({ provider, chainId: 1 });
        return () => null;
      },
    });

    const app = createApp(TestComponent);
    app.use(plugin);
    const container = document.createElement("div");
    app.mount(container);

    await nextTick();
    await Promise.resolve();
    await nextTick();

    expect(exposure?.status.value).toBe("ready");
    expect(exposure?.instance.value).toBe(mockInstance);
    expect(configuredInstanceMock).toHaveBeenCalled();

    app.unmount();
  });

  it("encrypts payload via useEncryptedInput", async () => {
    const config = makeConfig();
    const plugin = createFhevmVuePlugin({ config });

    const handles = [new Uint8Array([1, 2, 3])];
    const inputProof = new Uint8Array([4, 5, 6]);
    const encryptSpy = vi.fn().mockResolvedValue({ handles, inputProof });

    const builder = {
      add32: vi.fn(),
      encrypt: encryptSpy,
    };

    const instance = {
      createEncryptedInput: vi.fn().mockReturnValue(builder),
    };

    const signer = {
      getAddress: vi.fn().mockResolvedValue(
        "0x1111111111111111111111111111111111111111",
      ),
    } as unknown as JsonRpcSigner;

    let encryptFn:
      | ReturnType<typeof useEncryptedInput>
      | undefined;

    const TestComponent = defineComponent({
      setup() {
        encryptFn = useEncryptedInput({
          instance,
          contractAddress: "0x2222222222222222222222222222222222222222",
          signer,
        });
        return () => null;
      },
    });

    const app = createApp(TestComponent);
    app.use(plugin);
    const container = document.createElement("div");
    app.mount(container);

    await nextTick();

    const payload = await encryptFn!.encrypt(input => {
      (input as any).add32(42);
    });

    expect(instance.createEncryptedInput).toHaveBeenCalledWith(
      "0x2222222222222222222222222222222222222222",
      "0x1111111111111111111111111111111111111111",
    );
    expect(builder.add32).toHaveBeenCalledWith(42);
    expect(encryptSpy).toHaveBeenCalledTimes(1);
    expect(payload).toEqual({ handles, inputProof });
    expect(encryptFn!.lastPayload.value).toEqual({ handles, inputProof });
    expect(encryptFn!.canEncrypt.value).toBe(true);

    app.unmount();
  });
});

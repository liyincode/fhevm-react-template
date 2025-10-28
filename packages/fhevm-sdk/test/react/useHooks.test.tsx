import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../../src/core/instance/handle", () => {
  const handle = {
    status: "ready" as const,
    instance: { marker: "instance" },
    error: undefined,
  };
  const refreshMock = vi.fn();
  const abortMock = vi.fn();
  return {
    createInstanceHandle: vi.fn(() => ({
      get status() {
        return handle.status;
      },
      get instance() {
        return handle.instance;
      },
      get error() {
        return handle.error;
      },
      refresh: refreshMock,
      abort: abortMock,
    })),
  };
});

import { createFhevmConfig } from "../../src/core/config";
import { createMemoryPublicKeyStore } from "../../src/core/adapters/storage/memory";
import type { RelayerClientAdapter } from "../../src/core/config";
import type { FhevmInstance } from "../../src/shared/types/fhevmTypes";
import { FhevmProvider } from "../../src/platform/react/FhevmProvider";
import { useFhevmInstance } from "../../src/platform/react/useFhevm";
import { useEncryptedInput } from "../../src/platform/react/useFHEEncryption";

const makeRelayerClient = (): RelayerClientAdapter => ({
  load: vi.fn(),
  init: vi.fn().mockResolvedValue(true),
  createInstance: vi.fn(),
});

describe("React hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeWrapper = () => {
    const config = createFhevmConfig({
      chains: [{ id: 1, name: "Local" }],
      relayerClient: makeRelayerClient(),
      publicKeyStore: createMemoryPublicKeyStore(),
    });
    return ({ children }: { children: React.ReactNode }) => (
      <FhevmProvider config={config}>{children}</FhevmProvider>
    );
  };

  it("returns ready instance from useFhevmInstance", () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useFhevmInstance(), { wrapper });

    expect(result.current.status).toBe("ready");
    expect(result.current.instance).toEqual({ marker: "instance" });
  });

  it("encrypts payload via useEncryptedInput", async () => {
    const wrapper = makeWrapper();

    const encryptMock = vi.fn().mockResolvedValue({
      handles: [new Uint8Array([1, 2, 3])],
      inputProof: new Uint8Array([4, 5, 6]),
    });

    const addSpy = vi.fn();
    const instance: FhevmInstance = {
      createEncryptedInput: vi.fn().mockReturnValue({
        add32: addSpy,
        encrypt: encryptMock,
      }),
      generateKeypair: vi.fn() as any,
      createEIP712: vi.fn() as any,
      publicDecrypt: vi.fn() as any,
      userDecrypt: vi.fn() as any,
      getPublicKey: vi.fn() as any,
      getPublicParams: vi.fn() as any,
    } as unknown as FhevmInstance;

    const signer = {
      getAddress: vi.fn().mockResolvedValue("0x123"),
    } as unknown as any;

    const { result } = renderHook(
      () =>
        useEncryptedInput({
          instance,
          contractAddress: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
          signer,
        }),
      { wrapper },
    );

    expect(result.current.canEncrypt).toBe(true);

    await act(async () => {
      await result.current.encrypt(builder => {
        (builder as any).add32(1);
      });
    });

    expect(instance.createEncryptedInput).toHaveBeenCalledWith(
      "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      "0x123",
    );
    expect(addSpy).toHaveBeenCalledWith(1);
    expect(encryptMock).toHaveBeenCalled();
    expect(result.current.lastPayload).toEqual({
      handles: [new Uint8Array([1, 2, 3])],
      inputProof: new Uint8Array([4, 5, 6]),
    });
  });
});

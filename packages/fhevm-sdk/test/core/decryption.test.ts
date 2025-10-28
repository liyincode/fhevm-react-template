import { describe, it, expect, vi, beforeEach } from "vitest";
import { userDecrypt, publicDecrypt } from "../../src/core/crypto/decryption";
import { FhevmDecryptionSignature } from "../../src/shared/signature/FhevmDecryptionSignature";

const createStorage = () =>
  ({
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  } as any);

describe("userDecrypt", () => {
  const loadOrSignSpy = vi.spyOn(FhevmDecryptionSignature, "loadOrSign");

  beforeEach(() => {
    loadOrSignSpy.mockReset();
  });

  it("performs user decryption with signed payload", async () => {
    const signature = {
      privateKey: "priv",
      publicKey: "pub",
      signature: "sig",
      contractAddresses: ["0xaaa"],
      userAddress: "0xbbb",
      startTimestamp: 123,
      durationDays: 5,
    };

    loadOrSignSpy.mockResolvedValue(signature as any);

    const userDecryptSpy = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
    const instance = {
      userDecrypt: userDecryptSpy,
    };

    const requests = [
      { handle: "0xhandle", contractAddress: "0xaaa" as const },
      { handle: "0xhandle", contractAddress: "0xaaa" as const }, // duplicate to test unique set
    ] as const;

    const storage = createStorage();
    const signer = {} as any;

    const result = await userDecrypt({
      instance: instance as any,
      signer,
      requests,
      storage,
    });

    expect(loadOrSignSpy).toHaveBeenCalledWith(
      instance,
      ["0xaaa"],
      signer,
      storage,
      undefined,
    );

    expect(userDecryptSpy).toHaveBeenCalledTimes(1);
    expect(userDecryptSpy.mock.calls[0][0]).toEqual([
      { handle: "0xhandle", contractAddress: "0xaaa" },
      { handle: "0xhandle", contractAddress: "0xaaa" },
    ]);

    expect(userDecryptSpy.mock.calls[0].slice(1)).toEqual([
      signature.privateKey,
      signature.publicKey,
      signature.signature,
      signature.contractAddresses,
      signature.userAddress,
      signature.startTimestamp,
      signature.durationDays,
    ]);

    expect(result.result).toBeInstanceOf(Uint8Array);
    expect(result.signature).toBe(signature);
  });

  it("throws when signature cannot be created", async () => {
    loadOrSignSpy.mockResolvedValue(null as any);

    const instance = {
      userDecrypt: vi.fn(),
    };

    await expect(
      userDecrypt({
        instance: instance as any,
        signer: {} as any,
        requests: [{ handle: "0x1", contractAddress: "0xaaa" }] as const,
        storage: createStorage(),
      }),
    ).rejects.toThrow("Failed to create FHE decryption signature");
  });
});

describe("publicDecrypt", () => {
  it("throws when requests array is empty", async () => {
    await expect(
      publicDecrypt({
        instance: {} as any,
        requests: [],
      }),
    ).rejects.toThrow("publicDecrypt: requests array is empty");
  });

  it("throws when instance does not expose decrypt", async () => {
    await expect(
      publicDecrypt({
        instance: {} as any,
        requests: [{ handle: "0x1", contractAddress: "0xaaa" }] as const,
      }),
    ).rejects.toThrow(/does not support public decryption/);
  });

  it("returns decrypted payload from instance", async () => {
    const decryptMock = vi.fn().mockResolvedValue(new Uint8Array([1]));
    const instance = {
      decrypt: decryptMock,
    };

    const requests = [{ handle: "0x1", contractAddress: "0xaaa" }] as const;
    const result = await publicDecrypt({ instance: instance as any, requests });

    expect(decryptMock).toHaveBeenCalledWith([
      { handle: "0x1", contractAddress: "0xaaa" },
    ]);
    expect(result.result).toBeInstanceOf(Uint8Array);
  });

  it("wraps errors thrown by decrypt", async () => {
    const decryptMock = vi.fn().mockRejectedValue(new Error("boom"));
    const instance = {
      decrypt: decryptMock,
    };

    await expect(
      publicDecrypt({
        instance: instance as any,
        requests: [{ handle: "0x1", contractAddress: "0xaaa" }] as const,
      }),
    ).rejects.toThrow("publicDecrypt failed: boom");
  });
});

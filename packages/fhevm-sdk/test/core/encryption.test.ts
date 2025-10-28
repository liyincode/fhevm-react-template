import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  encryptInput,
  getEncryptionMethod,
  toHex,
  buildParamsFromAbi,
} from "../../src/core/crypto/encryption";

describe("encryptInput", () => {
  it("invokes builder and encrypts input", async () => {
    const handles = [new Uint8Array([1, 2, 3])];
    const inputProof = new Uint8Array([4, 5, 6]);
    const encryptMock = vi.fn().mockResolvedValue({ handles, inputProof });

    const builder = {
      add32: vi.fn(),
      encrypt: encryptMock,
    };

    const instance = {
      createEncryptedInput: vi.fn().mockReturnValue(builder),
    };

    const result = await encryptInput({
      instance: instance as any,
      contractAddress: "0x123",
      userAddress: "0x456",
      build: input => {
        (input as any).add32(42);
      },
    });

    expect(instance.createEncryptedInput).toHaveBeenCalledWith("0x123", "0x456");
    expect(builder.add32).toHaveBeenCalledWith(42);
    expect(builder.encrypt).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ handles, inputProof });
  });
});

describe("getEncryptionMethod", () => {
  const mappings: Array<[string, string]> = [
    ["externalEbool", "addBool"],
    ["externalEuint8", "add8"],
    ["externalEuint16", "add16"],
    ["externalEuint32", "add32"],
    ["externalEuint64", "add64"],
    ["externalEuint128", "add128"],
    ["externalEuint256", "add256"],
    ["externalEaddress", "addAddress"],
  ];

  for (const [inputType, method] of mappings) {
    it(`maps ${inputType} to ${method}`, () => {
      expect(getEncryptionMethod(inputType)).toBe(method);
    });
  }

  it("falls back to add64 for unknown types", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getEncryptionMethod("somethingUnknown")).toBe("add64");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("toHex", () => {
  it("returns the same string when already hex-prefixed", () => {
    expect(toHex("0xabc123")).toBe("0xabc123");
  });

  it("prefixes string values without 0x", () => {
    expect(toHex("deadbeef")).toBe("0xdeadbeef");
  });

  it("converts Uint8Array to hex", () => {
    const value = new Uint8Array([0, 15, 255]);
    expect(toHex(value)).toBe("0x000fff");
  });

  it("handles empty Uint8Array", () => {
    const value = new Uint8Array([]);
    expect(toHex(value)).toBe("0x");
  });
});

describe("buildParamsFromAbi", () => {
  const handles = [new Uint8Array([1, 2, 3]), new Uint8Array([7, 8, 9])];
  const inputProof = new Uint8Array([4, 5, 6]);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array when function has no inputs", () => {
    const params = buildParamsFromAbi(
      { handles: [], inputProof },
      [
        {
          type: "function",
          name: "noop",
          inputs: [],
        },
      ],
      "noop",
    );
    expect(params).toEqual([]);
  });

  it("throws when function ABI is missing", () => {
    expect(() =>
      buildParamsFromAbi(
        { handles, inputProof },
        [{ type: "function", name: "other", inputs: [] }],
        "missing",
      ),
    ).toThrow("Function ABI not found for missing");
  });

  it("maps handles and proof based on input names", () => {
    const params = buildParamsFromAbi(
      { handles, inputProof },
      [
        {
          type: "function",
          name: "operate",
          inputs: [
            { name: "encryptedValue", type: "bytes32" },
            { name: "inputProof", type: "bytes" },
          ],
        },
      ],
      "operate",
    );

    expect(params).toHaveLength(2);
    expect(params[0]).toBe("0x010203");
    expect(params[1]).toBe("0x040506");
  });

  it("falls back to proof when handles are exhausted", () => {
    const params = buildParamsFromAbi(
      { handles: [handles[0]], inputProof },
      [
        {
          type: "function",
          name: "multi",
          inputs: [
            { name: "first", type: "bytes32" },
            { name: "second", type: "uint256" },
          ],
        },
      ],
      "multi",
    );

    expect(params).toHaveLength(2);
    expect(params[0]).toBe("0x010203");
    expect(params[1]).toBe(BigInt("0x040506"));
  });

  it("recognises proof by internalType", () => {
    const params = buildParamsFromAbi(
      { handles, inputProof },
      [
        {
          type: "function",
          name: "operate",
          inputs: [
            { name: "encryptedValue", type: "bytes32" },
            { name: "proof", type: "bytes", internalType: "EncryptedInputProof" },
          ],
        },
      ],
      "operate",
    );

    expect(params).toEqual(["0x010203", "0x040506"]);
  });

  it("throws when not enough handles and no proof available", () => {
    expect(() =>
      buildParamsFromAbi(
        { handles: [], inputProof: undefined as unknown as Uint8Array },
        [
          {
            type: "function",
            name: "operate",
            inputs: [{ name: "value", type: "bytes32" }],
          },
        ],
        "operate",
      ),
    ).toThrow(/not enough encrypted handles/);
  });

  it("converts bool, string and address types correctly", () => {
    const customHandles = [
      new Uint8Array([1]),
      new Uint8Array([0, 1, 2]),
      new Uint8Array([0xab]),
    ];
    const params = buildParamsFromAbi(
      { handles: customHandles, inputProof: new Uint8Array([0]) },
      [
        {
          type: "function",
          name: "operate",
          inputs: [
            { name: "flag", type: "bool" },
            { name: "recipient", type: "address" },
            { name: "metadata", type: "string" },
          ],
        },
      ],
      "operate",
    );

    expect(params).toHaveLength(3);
    expect(params[0]).toBe(true);
    expect(params[1]).toBe("0x000102");
    expect(params[2]).toBe("0xab");
  });

  it("warns and returns hex for unknown ABI types", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const params = buildParamsFromAbi(
      { handles: [handles[0]], inputProof },
      [
        {
          type: "function",
          name: "operate",
          inputs: [{ name: "mystery", type: "CustomType" }],
        },
      ],
      "operate",
    );

    expect(params).toEqual(["0x010203"]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

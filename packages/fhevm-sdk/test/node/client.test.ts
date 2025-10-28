import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/platform/node/config", async actual => {
  const module = (await actual()) as typeof import("../../src/platform/node/config");
  return {
    ...module,
    createNodeFhevmConfig: vi.fn().mockReturnValue({ marker: "config" }),
  };
});

vi.mock("../../src/core/instance/client", async actual => {
  const module = (await actual()) as typeof import("../../src/core/instance/client");
  return {
    ...module,
    createFhevmClient: vi.fn().mockReturnValue({ client: true }),
  };
});

const { createNodeFhevmConfig } = await import("../../src/platform/node/config");
const { createFhevmClient } = await import("../../src/core/instance/client");
const { createNodeFhevmClient } = await import("../../src/platform/node/client");

describe("createNodeFhevmClient", () => {
  it("delegates to createNodeFhevmConfig and createFhevmClient", () => {
    const options = { chains: [{ id: 1, name: "Test" }], directory: "/tmp" };
    const client = createNodeFhevmClient(options as any);

    expect(createNodeFhevmConfig).toHaveBeenCalledWith(options);
    expect(createFhevmClient).toHaveBeenCalledWith({ marker: "config" });
    expect(client).toEqual({ client: true });
  });
});

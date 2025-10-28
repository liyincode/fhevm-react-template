import { createFhevmClient, type FhevmClient } from "../../core";
import type { NodeFhevmConfigOptions } from "./config";
import { createNodeFhevmConfig } from "./config";

// High-level helper returning a ready-to-use FHEVM client on Node.
export const createNodeFhevmClient = (options: NodeFhevmConfigOptions): FhevmClient => {
  const config = createNodeFhevmConfig(options);
  return createFhevmClient(config);
};

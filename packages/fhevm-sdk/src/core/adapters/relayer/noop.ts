import type { RelayerClientAdapter } from "../../config";

export const createNoopRelayerClient = (message?: string): RelayerClientAdapter => {
  const errorMessage = message ?? "Relayer client is not available in this environment.";

  const thrower = async () => {
    throw new Error(errorMessage);
  };

  return {
    load: thrower,
    init: thrower,
    createInstance: thrower,
    getSepoliaConfig: () => undefined,
  };
};

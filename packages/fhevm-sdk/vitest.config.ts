import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      vue: path.resolve(dirname, "test/__stubs__/vue.ts"),
    },
  },
});

import path from "node:path";
import { defineConfig } from "vitest/config";

const packageDir = (() => {
  const fromEnv = process.env.PNPM_PACKAGE_DIR;
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return process.cwd();
})();

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      vue: path.resolve(packageDir, "test/__stubs__/vue.ts"),
    },
  },
});

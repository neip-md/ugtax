import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      // Only the logic worth pinning. Pages and layouts are exercised by the
      // browser checks, not by unit tests.
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: ["lib/__tests__/**", "**/*.d.ts"],
      // A floor, not a target. Coverage was previously unmeasurable at all
      // (@vitest/coverage-v8 was never installed), so nothing stopped it from
      // regressing. Raise these as coverage improves.
      thresholds: {
        lines: 68,
        functions: 65,
        statements: 68,
        branches: 55,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});

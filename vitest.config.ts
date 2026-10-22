import path from "path"
import { defineConfig } from "vitest/config"

// Unit tests only. Playwright specs live in ./tests and are run by `npm run test:e2e`.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})

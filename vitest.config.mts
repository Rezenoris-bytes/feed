import { defineConfig } from "vitest/config";
import path from "node:path";
import { randomBytes } from "node:crypto";

const key = () => randomBytes(32).toString("base64");

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    // Unit tests use throwaway keys; they never touch the real .env secrets or database.
    env: {
      IDENTITY_ENCRYPTION_KEY: key(), FILE_ENCRYPTION_KEY: key(), SESSION_SECRET: key(),
      UPLOAD_DIR: "./storage/test-uploads", MAX_UPLOAD_MB: "1",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/unit/server-only-stub.ts"),
    },
  },
});

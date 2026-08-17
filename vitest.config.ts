import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    coverage: { reporter: ["text", "json", "html"] },
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
  },
});

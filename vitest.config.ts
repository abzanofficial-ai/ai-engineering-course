import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "@generated": fileURLToPath(new URL("./.content", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    testTimeout: 30_000,
    coverage: { include: ["src/content/**", "src/server/**", "src/lib/**"] },
    projects: [
      {
        resolve: { alias },
        test: { name: "unit", include: ["src/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          // One shared test database: run files one at a time.
          fileParallelism: false,
          setupFiles: ["tests/integration/setup.ts"],
          env: {
            DATABASE_URL:
              process.env.TEST_DATABASE_URL ??
              "postgres://lms:lms_local_only@localhost:5432/lms_test",
            EMAIL_TRANSPORT: "memory",
            ADMIN_EMAILS: "owner@example.test",
            NODE_ENV: "test",
          },
        },
      },
    ],
  },
});

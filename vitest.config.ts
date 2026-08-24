import { defineConfig } from "vitest/config";
import path from "node:path";

// Minimal config — this repo has no test runner precedent to follow, so the
// bar is "run plain .ts unit tests," not "match an existing convention."
// src/lib/volunteer/candidates.ts is the first thing in the codebase worth
// unit-testing (see VOLUNTEERS.md); nothing here touches React or a browser
// environment, so no jsdom/testing-library setup is included. The alias
// mirrors tsconfig.json's "@/*" -> "./src/*" — Vitest doesn't read Next's
// path mapping on its own.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});

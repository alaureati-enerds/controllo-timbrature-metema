import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

// Config minima per i test delle funzioni pure (nessun DOM, nessun I/O).
// L'alias @/ rispecchia il paths di tsconfig.json ("@/*" → "./*").
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    include: ["**/*.test.ts"],
  },
})

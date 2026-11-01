import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environmentMatchGlobs: [
      ["tests/components/**", "happy-dom"],
      ["tests/**", "node"],
    ],
  },
});

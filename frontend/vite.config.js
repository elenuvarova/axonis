/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Set API_PROXY_TARGET to point the dev server at another backend (e.g. a deployed site).
      "/api": { target: process.env.API_PROXY_TARGET || "http://localhost:3001", changeOrigin: true, secure: true },
    },
  },
  build: {
    outDir: "dist",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    css: false,
  },
});

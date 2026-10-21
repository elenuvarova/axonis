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
      // a regex key: a plain "/s" prefix would also catch /src/… and proxy the app itself
      "^/s/": { target: process.env.API_PROXY_TARGET || "http://localhost:3001", changeOrigin: true, secure: true },
    },
  },
  build: {
    outDir: "dist",
    // fonts always ship as files: Vite would inline the small unicode-range subsets as data: URIs,
    // which the CSP (font-src 'self') blocks
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    css: false,
  },
});

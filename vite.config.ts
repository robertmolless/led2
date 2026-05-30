import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Минимальный declare, чтобы не тянуть @types/node ради одной переменной.
// process в Node-окружении сборки доступен всегда, тут нужны только типы.
declare const process: { env: Record<string, string | undefined> };

// GitHub Pages base path.
// When deploying to https://<user>.github.io/<repo>/, set REPO_NAME=led-screen-builder
// (or whatever your repo is called) when running `npm run build`.
//
//   REPO_NAME=led-screen-builder npm run build
//
// Locally `npm run dev` uses "/" so nothing breaks.
const repoName = process.env.REPO_NAME ?? "";
const base = repoName ? `/${repoName}/` : "/";

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    outDir: "dist",
    sourcemap: false,
    assetsInlineLimit: 0
  },
  server: {
    host: true
  }
});

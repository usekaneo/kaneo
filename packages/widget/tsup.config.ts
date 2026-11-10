import { defineConfig } from "tsup";

export default defineConfig([
  // Library build — ESM + CJS + declarations.
  // Both module formats share chunks, including the singleton used by React.
  {
    entry: {
      index: "src/index.ts",
      "react/index": "src/react/index.ts",
      "ui/index": "src/ui/index.ts",
      version: "src/version.ts",
    },
    format: ["esm", "cjs"],
    splitting: true,
    // Declarations come from `tsc --emitDeclarationOnly` (TypeScript 7).
    // tsup's dts worker still imports the old compiler API (`ts.sys`).
    dts: false,
    sourcemap: true,
    target: "es2020",
    clean: true,
    external: ["react", "react/jsx-runtime"],
  },
  // Browser IIFE — served verbatim by /api/widget/sdk.js
  {
    entry: { browser: "src/browser-queue.ts" },
    format: ["iife"],
    globalName: "QuackbackBundle",
    noExternal: [/^zod(?:\/|$)/],
    minify: true,
    // Keeps the license notice on the served sdk.js (a different license from the server).
    banner: {
      js: "/*! @quackback/widget | Copyright (c) 2026 Quackback Ltd | MIT License: https://github.com/QuackbackIO/quackback/blob/main/packages/widget/LICENSE */",
    },
    sourcemap: false,
    target: "es2020",
    outExtension: () => ({ js: ".js" }),
  },
]);

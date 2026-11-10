import { brandResources } from "@kaneo/branding";
import { foldBrandCalls } from "../../scripts/branding/source.mjs";
import { brandHtml } from "../../scripts/branding/html.mjs";
import { packageOutput } from "../../scripts/branding/package-output.mjs";
import { prepareWebPublic } from "../../scripts/branding/prepare-web-public.mjs";

import path from "node:path";
import babel from "@rolldown/plugin-babel";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";
import packageJson from "../../package.json";

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
const uploadSourceMaps = Boolean(sentryAuthToken && sentryOrg && sentryProject);

export default defineConfig({
  run: {
    tasks: {
      compile: {
        command: "vp build",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: false,
      },
      "check:types": {
        command:
          "tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        // Typechecks read sources across the workspace and `auto` can't trace
        // tsc 7, so a cached result can be stale; always run them (like cli).
        cache: false,
      },
      "test:run": {
        command: "vp test run --config vitest.config.ts",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: false,
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  base: "/",
  plugins: lazyPlugins(() => [
    {
      name: "fork-branding",
      enforce: "pre",
      async config() {
        return { publicDir: await prepareWebPublic() };
      },
      transform(source, id) {
        const filename = id.split("?")[0] ?? id;
        if (/\/i18n\/[a-z]{2}-[A-Z]{2}\.json$/.test(filename))
          return JSON.stringify(brandResources(JSON.parse(source)));
        if (
          filename.includes("/apps/web/src/") &&
          /\.[jt]sx?$/.test(filename) &&
          source.includes("@kaneo/branding")
        )
          return foldBrandCalls(source, filename);
      },
      transformIndexHtml(html) {
        return brandHtml(html);
      },
      async closeBundle() {
        await packageOutput("apps/web/public", "apps/web/dist");
      },
    },
    tanstackRouter({
      autoCodeSplitting: true,
      // Keep co-located route tests out of the generated route tree.
      routeFileIgnorePattern: "\\.test\\.tsx?$",
    }),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    // Hidden when Sentry env vars are absent so local dev does not depend on it.
    ...(uploadSourceMaps
      ? [
          sentryVitePlugin({
            authToken: sentryAuthToken,
            org: sentryOrg,
            project: sentryProject,
            release: { name: packageJson.version },
            sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
          }),
        ]
      : []),
  ]),
  server: {
    host: true,
    hmr: true,
    port: 5173,
  },
  optimizeDeps: {
    exclude: ["better-auth"],
  },
  ssr: {
    noExternal: ["better-auth"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@i18n": path.resolve(__dirname, "../../i18n"),
    },
  },
  build: {
    // Generate maps only for private symbolication, then delete after upload.
    // "hidden" alone still writes publicly servable .map files.
    sourcemap: uploadSourceMaps ? "hidden" : false,
    rollupOptions: {},
    commonjsOptions: {
      include: [/better-auth/, /node_modules/],
      transformMixedEsModules: true,
    },
    target: "esnext",
  },
});

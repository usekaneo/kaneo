import { createRequire } from "node:module";
import path from "node:path";
import { SHARED_MODULES, SHARED_MODULES_GLOBAL } from "@kaneo/plugin-sdk";
import type { Plugin } from "vite-plus";
import {
  createImportMap,
  createSharedModuleShim,
  type SharedModuleShim,
  sharedModulePath,
  sharedModuleUrl,
} from "./shared-module-shims";

function readShims(root: string): SharedModuleShim[] {
  const require = createRequire(path.join(root, "package.json"));
  return SHARED_MODULES.map((specifier) =>
    createSharedModuleShim(
      specifier,
      Object.keys(require(specifier) as object),
      SHARED_MODULES_GLOBAL,
    ),
  );
}

export function pluginRuntime(): Plugin {
  let base = "/";
  let shims: SharedModuleShim[] = [];

  return {
    name: "kaneo-plugin-runtime",
    configResolved(config) {
      base = config.base;
      shims = readShims(config.root);
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split("?")[0];
        const shim = shims.find(
          (candidate) => sharedModuleUrl(base, candidate.fileName) === pathname,
        );
        if (!shim) {
          next();
          return;
        }
        response.setHeader("Content-Type", "text/javascript; charset=utf-8");
        response.setHeader("Cache-Control", "no-cache");
        response.end(shim.source);
      });
    },
    generateBundle() {
      for (const shim of shims) {
        this.emitFile({
          type: "asset",
          fileName: sharedModulePath(shim.fileName),
          source: shim.source,
        });
      }
    },
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: { type: "importmap" },
          children: JSON.stringify(createImportMap(shims, base)),
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

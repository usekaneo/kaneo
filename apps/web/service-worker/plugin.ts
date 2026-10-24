import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const routesDir = path.resolve(import.meta.dirname, "../src/routes");

// Emits sw.js with the files every screen needs: the entry, each route's
// chunk, their static imports, styles, and fonts. Rarely used lazy chunks
// (syntax languages, diagrams, other locales) are cached on first use, which
// keeps the install a few megabytes instead of twenty.
export function serviceWorker(): Plugin {
  return {
    name: "kaneo-service-worker",
    apply: "build",
    generateBundle(_options, bundle) {
      const files = new Set<string>();
      const add = (file: string) => {
        const output = bundle[file];
        if (!output || files.has(file)) return;
        files.add(file);
        if (output.type === "chunk") {
          output.imports.forEach(add);
          output.viteMetadata?.importedCss.forEach(add);
        }
      };
      for (const output of Object.values(bundle)) {
        if (output.type === "asset") {
          if (/\.(css|woff2)$/.test(output.fileName)) add(output.fileName);
        } else if (
          output.isEntry ||
          output.facadeModuleId?.startsWith(routesDir)
        ) {
          add(output.fileName);
        }
      }

      const assets = [...files]
        .filter((file) => file.startsWith("assets/"))
        .sort()
        .map((file) => `/${file}`);
      const version = createHash("sha256")
        .update(assets.join("\n"))
        .digest("hex")
        .slice(0, 12);
      const template = readFileSync(
        path.resolve(import.meta.dirname, "sw.js"),
        "utf8",
      );
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: template
          .replace("__KANEO_SW_VERSION__", version)
          .replace("__KANEO_SW_ASSETS__", JSON.stringify(assets)),
      });
    },
  };
}

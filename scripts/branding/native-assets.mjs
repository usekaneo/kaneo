import path from "node:path";
import { mkdir } from "node:fs/promises";
import { brand } from "../../branding/index.cjs";
import { applyAssets, root, safeCacheOutput } from "./assets.mjs";
import { checkAssets } from "./check.mjs";

const surface = "apps/mobile/assets";
const findings = await checkAssets([surface]);
if (findings.length) throw new Error(findings.join("\n"));
const output = await safeCacheOutput(path.join(root, ".cache/native-branding"));
await mkdir(output, { recursive: true });
await applyAssets(surface, output);
console.log(
  JSON.stringify(
    Object.fromEntries(
      brand.assets
        .filter((asset) => asset.target.startsWith(surface + "/"))
        .map((asset) => {
          return [
            "./" + asset.target.slice("apps/mobile/".length),
            path.join(output, asset.target.slice(surface.length + 1)),
          ];
        }),
    ),
  ),
);

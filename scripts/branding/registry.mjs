import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertPackageBrand } from "../../branding/index.cjs";
import { root, safeCacheOutput } from "./assets.mjs";
import { registryMetadata } from "./prepare-package.mjs";

assertPackageBrand();
const output = await safeCacheOutput(path.join(root, ".cache/mcp-registry"));
await mkdir(output, { recursive: true });
await writeFile(
  path.join(output, "server.json"),
  JSON.stringify(
    registryMetadata(
      JSON.parse(
        await readFile(path.join(root, "packages/mcp/server.json"), "utf8"),
      ),
    ),
    null,
    2,
  ) + "\n",
);

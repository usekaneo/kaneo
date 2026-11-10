import { cp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { root, safeCacheOutput, applyAssets, filesUnder } from "./assets.mjs";
import { brandManifest } from "./manifest.mjs";

export async function prepareWebPublic(
  output = path.join(root, `.cache/quills-web-public-${process.pid}`),
) {
  const target = await safeCacheOutput(output);
  const source = path.join(root, "apps/web/public");
  await filesUnder(source);
  await rm(target, { recursive: true, force: true });
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { recursive: true });
  await applyAssets("apps/web/public", target);
  const file = path.join(target, "site.webmanifest");
  await writeFile(
    file,
    JSON.stringify(
      brandManifest(
        JSON.parse(await readFile(file, "utf8")),
        "apps/web/public",
      ),
      null,
      2,
    ) + "\n",
  );
  return target;
}

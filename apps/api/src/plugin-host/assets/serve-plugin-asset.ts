import { readFile } from "node:fs/promises";
import type { Context } from "hono";
import { getLoadedPlugin } from "../registry";
import { assetContentType } from "./content-type";
import { assetEtag, etagMatches } from "./etag";
import { parseAssetPath } from "./parse-asset-path";
import { resolveAssetFile } from "./resolve-asset-file";

export async function servePluginAsset(c: Context): Promise<Response> {
  const notFound = () => c.json({ message: "Asset not found" }, 404);
  const plugin = getLoadedPlugin(c.req.param("pluginId") ?? "");
  const segments = parseAssetPath(new URL(c.req.url).pathname);
  if (!plugin?.web || !segments) return notFound();

  const contentType = assetContentType(segments[segments.length - 1] ?? "");
  if (!contentType) return notFound();

  const file = await resolveAssetFile(plugin.web, segments);
  if (!file) return notFound();

  const etag = assetEtag(plugin.version, file.size, file.mtimeMs);
  const headers = {
    "Cache-Control": "no-cache",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (etagMatches(c.req.header("If-None-Match"), etag)) {
    return new Response(null, { status: 304, headers });
  }

  const body = await readFile(file.path);
  return new Response(new Uint8Array(body), {
    headers: {
      ...headers,
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
    },
  });
}

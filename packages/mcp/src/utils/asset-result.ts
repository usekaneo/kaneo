import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Assets are capped at the API's default image upload limit (10 MiB). */
export const MAX_ASSET_BYTES = 10 * 1024 * 1024;

export type AssetMetadata = {
  id: string;
  filename: string | null;
  mimeType: string;
  size: number;
  url: string;
};

/**
 * Accepts either a bare asset id or the `/api/asset/<id>` URL that appears in
 * task and comment content, and returns just the id.
 */
export function extractAssetId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("assetId is required");
  }
  // Exclude punctuation that commonly wraps a URL (e.g. Markdown `)`,
  // quotes, or angle brackets) so only the id is captured.
  const fromUrl = trimmed.match(/\/api\/asset\/([^/?#\s"'<>()]+)/);
  const id = fromUrl?.[1] ?? trimmed;
  if (!id || /[/?#\s]/.test(id)) {
    throw new Error("assetId must be an asset ID or a /api/asset/<id> URL");
  }
  return id;
}

/** Prefers the RFC 5987 `filename*` value, then the plain `filename`. */
export function parseContentDispositionFilename(
  header: string | null,
): string | null {
  if (!header) {
    return null;
  }
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      return encoded[1];
    }
  }
  const plain = header.match(/filename="([^"]*)"/i);
  return plain?.[1] || null;
}

export function normalizeContentType(header: string | null): string {
  const value = (header ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return value || "application/octet-stream";
}

/**
 * MCP image content is only produced for types model APIs reliably accept.
 * Other image formats (HEIC, AVIF, APNG, SVG, ...) fall back to a resource
 * blob rather than failing the whole tool call in the host.
 */
const MCP_IMAGE_CONTENT_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isImageContentType(contentType: string): boolean {
  return MCP_IMAGE_CONTENT_TYPES.has(contentType);
}

/**
 * The asset route serves unsafe (non-inline) types as `application/octet-stream`
 * but reports the stored type in `X-Asset-Mime-Type`. Metadata should show the
 * real type; the transmitted bytes keep the safe type.
 */
export function resolveAssetContentTypes(headers: Headers): {
  mimeType: string;
  servedType: string;
} {
  const servedType = normalizeContentType(headers.get("content-type"));
  const stored = headers.get("x-asset-mime-type");
  return {
    mimeType: stored ? normalizeContentType(stored) : servedType,
    servedType,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export type LimitedBody = { bytes: Uint8Array } | { exceeded: true };

/**
 * Reads the body chunk by chunk and aborts as soon as it passes `limit`, so a
 * streamed asset with a missing or untrustworthy Content-Length cannot be
 * buffered in full before rejection.
 */
export async function readBodyWithLimit(
  res: Response,
  limit: number,
): Promise<LimitedBody> {
  if (!res.body) {
    return { bytes: new Uint8Array(0) };
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => {});
        return { exceeded: true };
      }
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  return { bytes: Buffer.concat(chunks, total) };
}

/**
 * Model-safe images become MCP `image` content so a client can display them;
 * every other type is an embedded resource blob labelled with the stored MIME
 * type. A short metadata block leads so callers can see the filename, size,
 * and source URL without decoding the payload.
 */
export function buildAssetResult(
  metadata: AssetMetadata,
  bytes: Uint8Array,
  servedType: string,
): CallToolResult {
  const base64 = Buffer.from(bytes).toString("base64");
  const content: CallToolResult["content"] = [
    { type: "text", text: JSON.stringify(metadata, null, 2) },
  ];
  if (isImageContentType(servedType)) {
    content.push({ type: "image", data: base64, mimeType: servedType });
  } else {
    content.push({
      type: "resource",
      resource: {
        uri: metadata.url,
        mimeType: metadata.mimeType,
        blob: base64,
      },
    });
  }
  return { content, isError: false };
}

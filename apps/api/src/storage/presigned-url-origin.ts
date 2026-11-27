// Presigned URLs are signed for the host in the URL (the S3_ENDPOINT host with
// path-style URLs, <bucket>.<endpoint host> otherwise), so only the origin can
// change. Whatever serves S3_PRESIGNED_URL_ORIGIN must forward the path and
// query unchanged and send that host as the Host header to S3.
export function parsePresignedUrlOrigin(value: string | undefined) {
  if (!value) return undefined;

  let url: URL | undefined;
  try {
    url = new URL(value);
  } catch {
    url = undefined;
  }

  if (
    !url ||
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "S3 uploads are not configured. S3_PRESIGNED_URL_ORIGIN must be an origin such as https://kaneo.example.com, without a path.",
    );
  }

  return url.origin;
}

// Parsed only here, so a bad value refuses uploads but leaves downloads and
// deletes of existing objects working.
export function withPresignedUrlOrigin(
  uploadUrl: string,
  originValue: string | undefined,
) {
  const origin = parsePresignedUrlOrigin(originValue);
  if (!origin) return uploadUrl;
  // Keep the signed path and query byte for byte instead of re-serializing them.
  const pathStart = uploadUrl.indexOf("/", uploadUrl.indexOf("//") + 2);
  return `${origin}${pathStart === -1 ? "/" : uploadUrl.slice(pathStart)}`;
}

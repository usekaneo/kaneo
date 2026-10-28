import { createMiddleware } from "hono/factory";

function privateCacheControl(cacheControl: string | null) {
  if (!cacheControl) return "private";
  if (/\b(private|no-store)\b/i.test(cacheControl)) return cacheControl;
  if (/\bpublic\b/i.test(cacheControl))
    return cacheControl.replace(/\bpublic\b/gi, "private");
  return `private, ${cacheControl}`;
}

export const applyApiKeyHeaders = createMiddleware<{
  Variables: { apiKeyHeaders?: Record<string, string> };
}>(async (c, next) => {
  await next();
  const headers = Object.entries(c.get("apiKeyHeaders") ?? {});
  if (headers.length === 0) return;
  for (const [name, value] of headers) c.header(name, value);
  c.header(
    "Cache-Control",
    privateCacheControl(c.res.headers.get("Cache-Control")),
  );
});

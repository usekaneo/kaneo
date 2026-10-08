import { createMiddleware } from "hono/factory";

export const applyApiKeyHeaders = createMiddleware<{
  Variables: { apiKeyHeaders?: Record<string, string> };
}>(async (c, next) => {
  await next();
  const headers = Object.entries(c.get("apiKeyHeaders") ?? {});
  if (headers.length === 0) return;
  for (const [name, value] of headers) c.header(name, value);
  const cacheControl = c.res.headers.get("Cache-Control");
  if (cacheControl && /\bpublic\b/i.test(cacheControl))
    c.header("Cache-Control", cacheControl.replace(/\bpublic\b/gi, "private"));
});

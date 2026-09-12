// The API's OpenAPI document is produced natively by @hono/zod-openapi
// (see createApp in ../index.ts), so the spec-rewriting helpers that used to
// live here are gone. This is the one piece of shared URL handling left.
export const normalizeApiServerUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

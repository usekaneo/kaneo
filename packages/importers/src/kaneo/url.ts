import { normalizeBaseUrl } from "../http.js";

const WEB_APP_ROUTE = /\/(?:dashboard|auth)(?:\/.*)?$/;

export function normalizeKaneoUrl(raw: string): string {
  const base = normalizeBaseUrl(raw);
  try {
    const url = new URL(base);
    const path = url.pathname
      .replace(WEB_APP_ROUTE, "")
      .replace(/\/+$/, "")
      .replace(/\/api$/, "");
    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return base.replace(/\/api$/, "");
  }
}

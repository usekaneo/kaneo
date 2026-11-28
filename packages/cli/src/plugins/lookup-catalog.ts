import { errorMessage } from "@kaneo/plugin-loader";
import { catalogStatus } from "./catalog-status.js";

export const DEFAULT_CATALOG_URL =
  "https://raw.githubusercontent.com/usekaneo/kaneo/main/catalog/index.json";

export type CatalogLookup =
  | { status: "listed" }
  | { status: "unlisted" }
  | { status: "unavailable"; reason: string };

export function catalogUrl(
  env: Readonly<Record<string, string | undefined>>,
): string {
  return env.KANEO_PLUGIN_CATALOG_URL?.trim() || DEFAULT_CATALOG_URL;
}

export async function lookupCatalog(
  packageName: string,
  {
    url,
    fetchIndex = fetch,
    timeoutMs = 10_000,
  }: {
    url: string;
    fetchIndex?: typeof fetch;
    timeoutMs?: number;
  },
): Promise<CatalogLookup> {
  let response: Response;
  try {
    response = await fetchIndex(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return { status: "unavailable", reason: errorMessage(error) };
  }
  if (!response.ok) {
    return {
      status: "unavailable",
      reason: `${url} answered with HTTP ${response.status}`,
    };
  }

  let index: unknown;
  try {
    index = await response.json();
  } catch {
    return { status: "unavailable", reason: `${url} did not return JSON` };
  }

  const status = catalogStatus(index, packageName);
  return status
    ? { status }
    : {
        status: "unavailable",
        reason: `${url} is not a Kaneo plugin catalog index`,
      };
}

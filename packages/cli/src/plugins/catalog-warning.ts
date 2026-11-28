import type { CatalogLookup } from "./lookup-catalog.js";

export function catalogWarning(
  packageName: string,
  catalog: Exclude<CatalogLookup, { status: "listed" }>,
): string {
  return catalog.status === "unlisted"
    ? `${packageName} is not listed in the Kaneo plugin catalog. Plugins run with full access to Kaneo, so only add packages you trust.`
    : `Could not check the Kaneo plugin catalog: ${catalog.reason}. Only add packages you trust.`;
}

import { brand, brandResources } from "../../branding/index.cjs";

export const omittedDocs = new Set([
  "core/deployments/railway",
  "core/installation/drim",
  "core/installation/drim-migration",
]);

export function isOmittedDoc(page) {
  return (
    omittedDocs.has(page) ||
    (!brand.npmScope && page === "core/integrations/mcp")
  );
}

export function brandDocsConfig(config) {
  const result = brandResources(config);
  if (/kaneo/i.test(JSON.stringify(config.analytics ?? {})))
    delete result.analytics;
  if (/kaneo/i.test(JSON.stringify(config.integrations?.plausible ?? {})))
    delete result.integrations.plausible;
  if (/usekaneo/i.test(result.footer?.socials?.x ?? ""))
    delete result.footer.socials.x;
  if (/usekaneo/i.test(result.seo?.metatags?.["twitter:site"] ?? ""))
    delete result.seo.metatags["twitter:site"];
  function navigation(value) {
    if (Array.isArray(value))
      return value
        .filter((item) => !isOmittedDoc(item))
        .map(navigation)
        .filter((item) => !item?.pages || item.pages.length);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, navigation(child)]),
      );
    return value;
  }
  result.navigation = navigation(result.navigation);
  return result;
}

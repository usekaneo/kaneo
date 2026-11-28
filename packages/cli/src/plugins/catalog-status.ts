export type CatalogStatus = "listed" | "unlisted";

export function catalogStatus(
  index: unknown,
  packageName: string,
): CatalogStatus | null {
  if (typeof index !== "object" || index === null) return null;
  const plugins = (index as { plugins?: unknown }).plugins;
  if (!Array.isArray(plugins)) return null;
  const listed = plugins.some(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      (entry as { package?: unknown }).package === packageName,
  );
  return listed ? "listed" : "unlisted";
}

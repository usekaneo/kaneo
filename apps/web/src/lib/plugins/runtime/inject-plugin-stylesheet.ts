const stylesheets = new Map<string, Promise<void>>();

export function injectPluginStylesheet(
  pluginId: string,
  href: string,
): Promise<void> {
  const existing = stylesheets.get(href);
  if (existing) return existing;

  const loaded = new Promise<void>((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.kaneoPlugin = pluginId;
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener("error", () => resolve(), { once: true });
    document.head.appendChild(link);
  });
  stylesheets.set(href, loaded);
  return loaded;
}

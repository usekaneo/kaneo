const stylesheets = new Map<string, Promise<void>>();

export function injectPluginStylesheet(
  pluginId: string,
  href: string,
): Promise<void> {
  const existing = stylesheets.get(href);
  if (existing) return existing;

  const loaded = new Promise<void>((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.kaneoPlugin = pluginId;
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener(
      "error",
      () => {
        link.remove();
        stylesheets.delete(href);
        reject(
          new Error(`Could not load the stylesheet for plugin "${pluginId}"`),
        );
      },
      { once: true },
    );
    document.head.appendChild(link);
  });
  stylesheets.set(href, loaded);
  return loaded;
}

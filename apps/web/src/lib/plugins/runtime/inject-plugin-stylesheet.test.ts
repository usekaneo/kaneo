import { afterEach, describe, expect, it } from "vite-plus/test";
import { injectPluginStylesheet } from "./inject-plugin-stylesheet";

function pluginLinks(href: string) {
  return [
    ...document.head.querySelectorAll<HTMLLinkElement>(
      "link[data-kaneo-plugin]",
    ),
  ].filter((link) => link.href.endsWith(href));
}

describe("injectPluginStylesheet", () => {
  afterEach(() => {
    for (const link of document.head.querySelectorAll(
      "link[data-kaneo-plugin]",
    )) {
      link.remove();
    }
  });

  it("reuses a stylesheet that loaded", async () => {
    const href = "/api/plugins/progress/assets/loaded.css";
    const first = injectPluginStylesheet("progress", href);
    pluginLinks(href)[0]?.dispatchEvent(new Event("load"));
    await first;

    await injectPluginStylesheet("progress", href);

    expect(pluginLinks(href)).toHaveLength(1);
  });

  it("removes a failed stylesheet so the next load fetches it again", async () => {
    const href = "/api/plugins/progress/assets/failed.css";
    const first = injectPluginStylesheet("progress", href);
    pluginLinks(href)[0]?.dispatchEvent(new Event("error"));

    await expect(first).rejects.toThrow(
      'Could not load the stylesheet for plugin "progress"',
    );
    expect(pluginLinks(href)).toHaveLength(0);

    const retry = injectPluginStylesheet("progress", href);
    expect(retry).not.toBe(first);
    expect(pluginLinks(href)).toHaveLength(1);
    pluginLinks(href)[0]?.dispatchEvent(new Event("load"));
    await retry;
  });
});

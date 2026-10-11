import { describe, expect, it } from "vite-plus/test";
import { pluginNamespace, translationBundles } from "./plugin-translations";

describe("translationBundles", () => {
  const locales = ["en-US", "de-DE", "pt-BR"];

  it("maps language codes onto supported locales without overriding exact ones", () => {
    const en = { title: "Progress" };
    const deDE = { title: "Fortschritt" };
    const de = { title: "Fortschritt (de)" };

    expect(
      translationBundles(
        { en, "de-de": deDE, de, broken: "nope" } as never,
        locales,
      ),
    ).toEqual([
      ["en", en],
      ["de-DE", deDE],
      ["de", de],
      ["en-US", en],
    ]);
  });

  it("keeps locales Kaneo does not ship", () => {
    const sv = { title: "Framsteg" };
    expect(translationBundles({ "sv-SE": sv }, locales)).toEqual([
      ["sv-SE", sv],
    ]);
  });
});

describe("pluginNamespace", () => {
  it("prefixes the plugin id", () => {
    expect(pluginNamespace("task-progress")).toBe("plugin-task-progress");
  });
});

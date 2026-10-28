import { describe, expect, it } from "vite-plus/test";
import {
  resolveSupportedLocale,
  SUPPORTED_LOCALES,
} from "../../../apps/api/src/utils/supported-locales";
import { supportedLocales } from "../../../i18n/resources";

describe("SUPPORTED_LOCALES", () => {
  it("matches the locales the web app ships, in the same order", () => {
    expect(SUPPORTED_LOCALES).toEqual(supportedLocales);
  });
});

describe("resolveSupportedLocale", () => {
  it.each([
    ["de-DE", "de-DE"],
    ["DE-de", "de-DE"],
    ["de", "de-DE"],
    ["en", "en-US"],
    ["en-GB", "en-US"],
    ["pt_BR", "pt-BR"],
    [" fr-CA ", "fr-FR"],
    ["zh-TW", "zh-TW"],
    ["zh", "zh-CN"],
    ["zh-Hant", "zh-TW"],
    ["zh_Hant", "zh-TW"],
    ["zh-Hant-TW", "zh-TW"],
    ["zh-HK", "zh-TW"],
    ["zh-MO", "zh-TW"],
    ["zh-Hans", "zh-CN"],
    ["zh-Hans-HK", "zh-CN"],
    ["zh-SG", "zh-CN"],
  ])("resolves %p to %p", (value, expected) => {
    expect(resolveSupportedLocale(value)).toBe(expected);
  });

  it.each(["sv", "sv-SE", "", "  ", 42, null, undefined, ["de"]])(
    "has no supported locale for %p",
    (value) => {
      expect(resolveSupportedLocale(value)).toBeNull();
    },
  );
});

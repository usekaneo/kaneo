import { type AppLocale, supportedLocales } from "@i18n/resources";
import { describe, expect, it, vi } from "vite-plus/test";
import { getLocaleLabel } from "./get-locale-label";

// Real locales plus siblings that share a language with one of them
vi.mock("@i18n/resources", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@i18n/resources")>();
  return {
    ...actual,
    supportedLocales: [...actual.supportedLocales, "en-GB", "pt-PT"],
  };
});

const label = (locale: string) => getLocaleLabel(locale as AppLocale);

describe("getLocaleLabel", () => {
  it("distinguishes locales that share a language", () => {
    expect(label("en-US")).toBe("American English");
    expect(label("en-GB")).toBe("British English");
    expect(label("pt-BR")).not.toBe(label("pt-PT"));
  });

  it("shows only the language when no other locale shares it", () => {
    expect(label("ja-JP")).toBe("日本語");
  });

  it("gives every supported locale a unique label", () => {
    const labels = supportedLocales.map(label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

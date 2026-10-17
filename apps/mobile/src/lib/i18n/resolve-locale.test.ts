import { describe, expect, it } from "vite-plus/test";
import { resolveLocale } from "./resolve-locale";

describe("resolveLocale", () => {
  it("matches the region, then the language", () => {
    expect(resolveLocale(["zh-TW"])).toBe("zh-TW");
    expect(resolveLocale(["de-AT"])).toBe("de-DE");
    expect(resolveLocale(["pt_PT"])).toBe("pt-BR");
  });

  it("picks Chinese by script", () => {
    expect(resolveLocale(["zh-Hant-TW"])).toBe("zh-TW");
    expect(resolveLocale(["zh-Hant"])).toBe("zh-TW");
    expect(resolveLocale(["zh-HK"])).toBe("zh-TW");
    expect(resolveLocale(["zh_Hans_CN"])).toBe("zh-CN");
    expect(resolveLocale(["zh"])).toBe("zh-CN");
  });

  it("falls back to the next candidate, then en-US", () => {
    expect(resolveLocale([null, "fr-CA"])).toBe("fr-FR");
    expect(resolveLocale(["xx-YY"])).toBe("en-US");
  });
});

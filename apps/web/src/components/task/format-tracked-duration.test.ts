import { createInstance } from "i18next";
import { describe, expect, it } from "vite-plus/test";
import german from "@i18n/de-DE.json";
import english from "@i18n/en-US.json";
import formatDuration from "./format-tracked-duration";

describe("formatDuration", () => {
  it("formats durations with the selected language's units and numbers", async () => {
    const i18n = createInstance();
    await i18n.init({
      lng: "en-US",
      resources: { "en-US": english, "de-DE": german },
    });

    expect(formatDuration(-1, i18n.t)).toBe("0s");
    expect(formatDuration(5, i18n.t)).toBe("5s");
    expect(formatDuration(60, i18n.t)).toBe("1m");
    expect(formatDuration(4500, i18n.t)).toBe("1h 15m");

    await i18n.changeLanguage("de-DE");
    expect(formatDuration(5, i18n.t)).toBe("5 Sek.");
    expect(formatDuration(60, i18n.t)).toBe("1 Min.");
    expect(formatDuration(4500, i18n.t)).toBe("1 Std. 15 Min.");
    expect(formatDuration(3600000, i18n.t)).toBe("1.000 Std. 0 Min.");
  });
});

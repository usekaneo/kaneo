import { brand, missingTranslation } from "@kaneo/branding";
import { createInstance } from "i18next";
import { expect, it } from "vite-plus/test";

it("preserves i18next fallback values while branding missing lookup keys", async () => {
  const i18n = createInstance();
  await i18n.init({
    lng: "en-US",
    resources: {},
    parseMissingKeyHandler: missingTranslation,
  });

  expect(
    i18n.t("tasks:status.removed-lane", { defaultValue: "Removed Lane" }),
  ).toBe("Removed Lane");
  expect(
    i18n.t("tasks:status.custom", { defaultValue: "Kaneo customer group" }),
  ).toBe("Kaneo customer group");
  expect(i18n.t("tasks:status.empty", { defaultValue: "" })).toBe("");
  expect(i18n.t("common:welcomeToKaneo")).toBe(`welcomeTo${brand.name}`);
});

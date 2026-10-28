const fs = require("node:fs");
const path = require("node:path");

const CATALOG = path.join(__dirname, "../../../i18n");
// iOS matches InfoPlist.strings by language, except Chinese, which it matches by script.
const LPROJ = { "zh-CN": "zh-Hans", "zh-TW": "zh-Hant" };

/**
 * iOS shows permission prompts with the text from Info.plist, which can't come from i18next at
 * runtime. This copies `mobile.permissions` from the shared catalog into per-language
 * InfoPlist.strings, so the photo prompt matches the app's language. The English text in app.json
 * stays the fallback for languages without a catalog.
 */
module.exports = function withPermissionLocales(config) {
  const locales = { ...config.locales };
  for (const file of fs.readdirSync(CATALOG)) {
    if (!/^[a-z]{2}-[A-Z]{2}\.json$/.test(file)) continue;
    const locale = file.slice(0, -".json".length);
    const { permissions } = JSON.parse(
      fs.readFileSync(path.join(CATALOG, file), "utf8"),
    ).mobile;
    const lang = LPROJ[locale] ?? locale.split("-")[0];
    locales[lang] = {
      ...locales[lang],
      ios: { NSPhotoLibraryUsageDescription: permissions.photos },
    };
  }
  return { ...config, locales };
};

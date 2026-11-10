const { brand, brandText, assertReleaseBrand } = require("@kaneo/branding");

const { execFileSync } = require("node:child_process");
const path = require("node:path");

module.exports = ({ config }) => {
  let replacements = {};
  if (
    process.env.EAS_BUILD === "true" ||
    process.env.NODE_ENV === "production"
  ) {
    assertReleaseBrand();
    replacements = JSON.parse(
      execFileSync(
        process.execPath,
        [path.join(__dirname, "../../scripts/branding/native-assets.mjs")],
        { encoding: "utf8" },
      ),
    );
  }
  function assets(value) {
    if (typeof value === "string") return replacements[value] ?? value;
    if (Array.isArray(value)) return value.map(assets);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, assets(child)]),
      );
    return value;
  }
  return {
    ...assets(config),
    name: brand.name,
    plugins: assets(config.plugins).map((plugin) =>
      Array.isArray(plugin) && plugin[0] === "expo-image-picker"
        ? [
            plugin[0],
            {
              ...plugin[1],
              photosPermission: brandText(plugin[1].photosPermission),
            },
          ]
        : plugin,
    ),
  };
};

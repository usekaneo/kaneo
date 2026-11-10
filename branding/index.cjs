const brand = require("./config.json");
const upstreamName =
  /(^|[^A-Za-z0-9_.@])(?:Kaneo|KANEO)(?![A-Za-z0-9_]|\.[A-Za-z])/g;
const destinations = {
  "https://api.github.com/repos/usekaneo/kaneo": brand.releaseApiUrl,
  "https://github.com/usekaneo/kaneo": brand.repositoryUrl,
  "support@kaneo.app": brand.supportEmail,
  "https://kaneo.app/docs": brand.docsUrl,
  "https://cloud.kaneo.app": brand.clientUrl,
  "https://demo.kaneo.app": brand.clientUrl,
  "https://assets.kaneo.app": brand.assetsUrl,
  "https://kaneo.app": brand.publicUrl,
};

/** Apply only to application-owned copy, never user data or protocol values. */
function brandText(value) {
  if (!/kaneo/i.test(value)) return value;
  let result = value;
  for (const [source, target] of Object.entries(destinations)) {
    result = result.replace(
      new RegExp(
        source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z0-9_.-])",
        "gi",
      ),
      () => target,
    );
  }
  for (const [host, destination] of Object.entries({
    "cloud.kaneo.app": brand.clientUrl,
    "demo.kaneo.app": brand.clientUrl,
    "assets.kaneo.app": brand.assetsUrl,
    "kaneo.app": brand.publicUrl,
  }))
    result = result.replace(
      new RegExp(
        "(^|[^A-Za-z0-9.@-])" +
          host.replaceAll(".", "\\.") +
          "(?![A-Za-z0-9.-])",
        "gi",
      ),
      (_match, prefix) => prefix + new URL(destination).host,
    );
  const examples = {
    "api.kaneo.example.com": "api.projects.example.com",
    "kaneo.example.com": "projects.example.com",
    "kaneo.example": "projects.example",
    "your-kaneo-instance.com": "projects.example.com",
    "your-kaneo-host": "your-project-host",
    "kaneo-your-team": "project-manager-your-team",
    "https://example.com/webhooks/kaneo":
      "https://example.com/webhooks/project-manager",
    "kaneo CLI": "CLI",
    "kaneo command": "CLI command",
  };
  for (const [source, target] of Object.entries(examples))
    result = result.split(source).join(target);
  result = result.split("ghcr.io/usekaneo").join(brand.imageBase);
  const repository =
    new URL(brand.repositoryUrl).pathname.replace(/^\/|\/$/g, "") ||
    "OWNER/REPOSITORY";
  result = result.split("usekaneo/kaneo").join(repository);
  if (brand.npmScope)
    result = result
      .split("\n")
      .map((line) =>
        /pnpm[^\n]*--filter|workspace:\*/.test(line)
          ? line
          : line.replace(
              /@kaneo\/(mcp|cli|planka-import)\b/g,
              (_match, name) => `@${brand.npmScope}/${name}`,
            ),
      )
      .join("\n");
  return result.replace(upstreamName, (_match, prefix) => prefix + brand.name);
}

/** Preserve catalog keys and interpolation tokens. */
function brandResources(value) {
  if (typeof value === "string") {
    return value
      .split(/(\{\{.*?\}\})/g)
      .map((part) => (part.startsWith("{{") ? part : brandText(part)))
      .join("");
  }
  if (Array.isArray(value)) return value.map(brandResources);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        brandResources(
          typeof child === "string" &&
            (key === "webhookPlaceholder" || key === "webhookUrlPlaceholder")
            ? child.replace(/\/webhooks\/kaneo\b/g, "/webhooks/project-manager")
            : child,
        ),
      ]),
    );
  }
  return value;
}

function instanceName(value) {
  const name = value?.trim();
  return !name || /^kaneo$/i.test(name) ? brand.name : name;
}

exports.brand = brand;
exports.brandText = brandText;
exports.brandResources = brandResources;
exports.instanceName = instanceName;

function assertReleaseBrand() {
  if (
    !brand.name.trim() ||
    /[<>\r\n]|PRODUCT_NAME|kaneo|caneo|kenya/i.test(brand.name)
  )
    throw new Error("Set an approved product name in branding/config.json");
  for (const field of [
    "publicUrl",
    "clientUrl",
    "docsUrl",
    "supportUrl",
    "assetsUrl",
    "repositoryUrl",
    "releaseApiUrl",
  ]) {
    const url = new URL(brand[field]);
    if (
      url.protocol !== "https:" ||
      url.hostname.endsWith(".invalid") ||
      /kaneo|caneo|kenya/i.test(url.href)
    )
      throw new Error(`Set an approved HTTPS destination: ${field}`);
  }
  if (
    !/^ghcr\.io\/[a-z0-9][a-z0-9._/-]*$/.test(brand.imageBase) ||
    /OWNER|PRODUCT_NAME/.test(brand.imageBase)
  )
    throw new Error("Set a fork-owned imageBase");
  if (
    !brand.mcpRegistryName ||
    /OWNER|PRODUCT_NAME|usekaneo|kaneo/i.test(brand.mcpRegistryName)
  )
    throw new Error("Set a fork-owned mcpRegistryName");
  if (
    brand.appStoreUrl &&
    (!brand.appStoreUrl.startsWith("https://apps.apple.com/") ||
      /id6828574501/.test(brand.appStoreUrl))
  )
    throw new Error("Set a fork-owned appStoreUrl or null");
  if (
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(brand.supportEmail) ||
    /\.invalid$|kaneo|caneo|kenya/i.test(brand.supportEmail)
  )
    throw new Error("Set an approved supportEmail");
}
exports.assertReleaseBrand = assertReleaseBrand;

function assertPackageBrand() {
  assertReleaseBrand();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(brand.npmScope))
    throw new Error("Set a fork-owned npmScope before publishing packages");
}
exports.assertPackageBrand = assertPackageBrand;

/** i18next can expose a missing key; retain lookup keys but keep fallback display branded. */
function missingTranslation(key, defaultValue) {
  return defaultValue ?? key.replace(/kaneo|caneo|kenya/gi, () => brand.name);
}
exports.missingTranslation = missingTranslation;

/** Version approved public artwork so existing clients cannot reuse upstream images. */
function brandAssetUrl(target) {
  const asset = brand.assets.find(
    (item) => item.approved && item.target === target,
  );
  if (!asset) return undefined;
  const relative = target
    .replace(/^apps\/(?:web|site)\/public\//, "")
    .replace(/^apps\/docs\//, "")
    .replace(/(^|\/)kaneo-/g, "$1product-");
  return `/${relative}?brand=${asset.sha256}`;
}
exports.brandAssetUrl = brandAssetUrl;

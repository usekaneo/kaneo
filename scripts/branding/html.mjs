import { brandAssetUrl, brand, brandText } from "../../branding/index.cjs";

export function brandHtml(html) {
  const output = brandText(
    html.replace(/<script>[\s\S]*?<\/script>/g, (script) =>
      script.includes("plausible.kaneo.app") ? "" : script,
    ),
  );
  const name = brand.name
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  let result = output.replaceAll(brand.name, name);
  const social = brandAssetUrl("apps/web/public/readme.png");
  if (social)
    result = result.replace(
      /(<meta (?:property|name)="(?:og|twitter):image" content=")[^"]*(")/g,
      (_match, before, after) =>
        before + new URL(social, brand.publicUrl).href + after,
    );
  for (const asset of brand.assets.filter(
    (item) => item.approved && item.target.startsWith("apps/web/public/"),
  )) {
    const path = "/" + asset.target.slice("apps/web/public/".length);
    result = result.split(`"${path}"`).join(`"${brandAssetUrl(asset.target)}"`);
  }
  return result.replace(
    'href="/site.webmanifest"',
    `href="/site.webmanifest?brand=${encodeURIComponent(brand.name)}"`,
  );
}

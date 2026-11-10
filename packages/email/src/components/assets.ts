import { brand, brandAssetUrl } from "@kaneo/branding";
export function emailAsset(name: string): string {
  const explicit = process.env.KANEO_EMAIL_ASSETS_URL;
  const clientUrl = process.env.KANEO_CLIENT_URL;
  let base = explicit
    ? explicit
    : clientUrl
      ? `${clientUrl.replace(/\/$/, "")}/email`
      : "/static";

  const hostname = new URL(base, "https://instance.invalid").hostname;
  if (hostname === "kaneo.app" || hostname.endsWith(".kaneo.app"))
    base = `${brand.assetsUrl.replace(/\/$/, "")}/email`;
  const approved = brandAssetUrl(`apps/web/public/email/${name}.png`);
  const revision = approved?.split("?")[1];
  return `${base.replace(/\/$/, "")}/${name}.png${revision ? `?${revision}` : ""}`;
}

import { brandAssetUrl, brandResources } from "../../branding/index.cjs";

export function brandManifest(value, surface) {
  const manifest = brandResources(value);
  for (const icon of manifest.icons ?? [])
    if (icon.src?.startsWith("/"))
      icon.src =
        brandAssetUrl(`${surface}${icon.src.split(/[?#]/)[0]}`) ?? icon.src;
  return manifest;
}

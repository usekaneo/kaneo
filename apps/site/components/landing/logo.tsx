import { brandAssetUrl, brand } from "@kaneo/branding";
import Image from "next/image";

export function Logo() {
  const artwork =
    process.env.NODE_ENV === "production" &&
    ["logo-dark.svg", "logo-light.svg"].every((name) =>
      brand.assets.some(
        (asset) =>
          asset.approved && asset.target === `apps/site/public/${name}`,
      ),
    );
  return (
    <span className="inline-flex items-center font-semibold">
      {artwork ? (
        <>
          <Image
            src={brandAssetUrl("apps/site/public/logo-dark.svg")!}
            alt={brand.name}
            width={24}
            height={24}
            className="h-6 w-auto dark:hidden"
          />
          <Image
            src={brandAssetUrl("apps/site/public/logo-light.svg")!}
            alt={brand.name}
            width={24}
            height={24}
            className="hidden h-6 w-auto dark:block"
          />
        </>
      ) : (
        brand.name
      )}
    </span>
  );
}

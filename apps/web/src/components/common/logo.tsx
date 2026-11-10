import { brandAssetUrl, brand, brandText } from "@kaneo/branding";
import { Link } from "@tanstack/react-router";
import useProjectStore from "@/store/project";

type LogoProps = {
  className?: string;
};

export function Logo({ className = "" }: LogoProps) {
  const { setProject } = useProjectStore();
  const artwork = ["logo-dark.svg", "logo-light.svg"].every((name) =>
    brand.assets.some(
      (asset) => asset.approved && asset.target === `apps/web/public/${name}`,
    ),
  );

  return (
    <Link
      onClick={() => {
        setProject(undefined);
      }}
      to="/dashboard"
      className={`w-auto ${className}`}
    >
      {artwork ? (
        <>
          <img
            src={brandAssetUrl("apps/web/public/logo-dark.svg")}
            alt={brand.name}
            className="h-6 w-auto dark:hidden"
          />
          <img
            src={brandAssetUrl("apps/web/public/logo-light.svg")}
            alt={brand.name}
            className="hidden h-6 w-auto dark:block"
          />
        </>
      ) : (
        <span className="font-semibold">{brandText("Kaneo")}</span>
      )}
    </Link>
  );
}

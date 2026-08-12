import { Link } from "@tanstack/react-router";
import { useBranding } from "@/hooks/use-branding";
import useProjectStore from "@/store/project";

type LogoProps = {
  className?: string;
};

export function Logo({ className = "" }: LogoProps) {
  const { setProject } = useProjectStore();
  const { branding } = useBranding();
  const lightSrc = branding.logoUrl || "/logo-dark.svg";
  const darkSrc = branding.logoDarkUrl || branding.logoUrl || "/logo-light.svg";

  return (
    <Link
      onClick={() => {
        setProject(undefined);
      }}
      to="/dashboard"
      className={`w-auto ${className}`}
    >
      <img
        src={lightSrc}
        alt={branding.displayName}
        className="h-6 w-auto dark:hidden"
      />
      <img
        src={darkSrc}
        alt={branding.displayName}
        className="hidden h-6 w-auto dark:block"
      />
    </Link>
  );
}

import { Link } from "@tanstack/react-router";
import useProjectStore from "@/store/project";

type LogoProps = {
  className?: string;
};

export function Logo({ className = "" }: LogoProps) {
  const { setProject } = useProjectStore();

  return (
    <Link
      onClick={() => {
        setProject(undefined);
      }}
      to="/dashboard"
      className={`w-auto ${className}`}
    >
      <img
        src={lightThemeLogo}
        alt={appName}
        className="h-6 w-auto dark:hidden"
      />
      <img
        src={darkThemeLogo}
        alt={appName}
        className="hidden h-6 w-auto dark:block"
      />
    </Link>
  );
}

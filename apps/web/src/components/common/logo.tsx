import { Link } from "@tanstack/react-router";
import useProjectStore from "@/store/project";

type LogoProps = {
  className?: string;
  imageClassName?: string;
};

export function Logo({
  className = "",
  imageClassName = "h-6 w-auto",
}: LogoProps) {
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
        src="/logo-dark.svg"
        alt="IPSTUDIO"
        className={`${imageClassName} dark:hidden`}
      />
      <img
        src="/logo-light.svg"
        alt="IPSTUDIO"
        className={`hidden ${imageClassName} dark:block`}
      />
    </Link>
  );
}

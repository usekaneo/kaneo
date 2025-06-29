import useGetConfig from "@/hooks/queries/config/use-get-config";
import { Link } from "@tanstack/react-router";

interface AuthToggleProps {
  message: string;
  linkText: string;
  linkTo: string;
}

export function AuthToggle({ message, linkText, linkTo }: AuthToggleProps) {
  const { data: config } = useGetConfig();

  if (config?.disableRegistration) {
    return null;
  }

  return (
    <div className="mt-6 text-center">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {message}{" "}
        <Link
          to={linkTo}
          className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
        >
          {linkText}
        </Link>
      </p>
    </div>
  );
}

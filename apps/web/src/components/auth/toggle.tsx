import { Link } from "@tanstack/react-router";
import useGetConfig from "@/hooks/queries/config/use-get-config";

type AuthToggleSearch = {
  invitationId?: string;
  email?: string;
};

type AuthToggleProps = {
  message: string;
  linkText: string;
  linkTo: "/auth/sign-in" | "/auth/sign-up";
  search?: AuthToggleSearch;
};

export function AuthToggle({
  message,
  linkText,
  linkTo,
  search,
}: AuthToggleProps) {
  const { data: config } = useGetConfig();
  const hasInvitation = Boolean(search?.invitationId);

  if (
    (config?.disableRegistration || config?.disablePasswordRegistration) &&
    !hasInvitation
  ) {
    return null;
  }

  return (
    <div className="text-center text-sm text-muted-foreground mt-3">
      {message}{" "}
      <Link
        to={linkTo}
        search={search}
        className="underline underline-offset-4 hover:text-primary"
      >
        {linkText}
      </Link>
    </div>
  );
}

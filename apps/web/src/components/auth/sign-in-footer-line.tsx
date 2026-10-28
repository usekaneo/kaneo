import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { authLinkClassName } from "./auth-link-class";
import type { SignInFooter } from "./auth-methods";

type SignInFooterLineProps = {
  footer: SignInFooter;
  invitationId?: string;
  email?: string;
};

export function SignInFooterLine({
  footer,
  invitationId,
  email,
}: SignInFooterLineProps) {
  const { t } = useTranslation();

  if (footer === "createAccount") {
    return (
      <p>
        {t("auth:signIn.footer.newHere")}{" "}
        <Link
          to="/auth/sign-up"
          search={{ invitationId, email }}
          className={authLinkClassName}
        >
          {t("auth:signIn.footer.createAccount")}
        </Link>
      </p>
    );
  }

  const messages: Record<Exclude<SignInFooter, "createAccount">, string> = {
    inviteOnly: t("auth:signIn.footer.inviteOnly"),
    providerSignUp: t("auth:signIn.footer.providerSignUp"),
    anyProvider: t("auth:signIn.footer.anyProvider"),
    contactAdmin: t("auth:signIn.footer.contactAdmin"),
  };

  return <p>{messages[footer]}</p>;
}

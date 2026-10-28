import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import { authLinkClassName } from "./auth-link-class";
import { AuthPage } from "./auth-page";

const FALLBACK_DELAY_MS = 3000;

type AutoLoginRedirectProps = {
  providerName: string;
  onContinue: () => void;
};

export function AutoLoginRedirect({
  providerName,
  onContinue,
}: AutoLoginRedirectProps) {
  const { t } = useTranslation();
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setShowFallback(true), FALLBACK_DELAY_MS);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <AuthPage
      title={t("auth:signIn.autoLogin.title")}
      description={t("auth:signIn.autoLogin.subtitle")}
    >
      <div
        role="status"
        className="flex h-9 items-center gap-2.5 rounded-lg border border-input px-3.5 text-foreground text-sm dark:bg-input/32"
      >
        <Spinner
          role="presentation"
          aria-hidden="true"
          className="size-4 text-muted-foreground"
        />
        {t("auth:signIn.autoLogin.opening", { provider: providerName })}
      </div>
      {showFallback ? (
        <p className="pt-8 text-muted-foreground text-sm">
          {t("auth:signIn.autoLogin.stuck")}{" "}
          <button
            type="button"
            className={authLinkClassName}
            onClick={onContinue}
          >
            {t("auth:signIn.autoLogin.continue", { provider: providerName })}
          </button>
        </p>
      ) : null}
    </AuthPage>
  );
}

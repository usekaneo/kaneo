import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Trans, useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "../../components/auth/layout";

export const Route = createFileRoute("/auth/check-email")({
  component: CheckEmail,
  validateSearch: (search: Record<string, unknown>) => ({
    email: search.email as string | undefined,
  }),
});

function CheckEmail() {
  const { t } = useTranslation();
  const { email } = useSearch({ from: "/auth/check-email" });

  return (
    <>
      <PageTitle title={t("auth:checkEmail.pageTitle")} />
      <AuthLayout title={t("auth:checkEmail.title")}>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <Trans
                i18nKey="auth:checkEmail.inboxMessage"
                values={{
                  email: email || t("auth:checkEmail.emailFallback"),
                }}
                components={{
                  email: <span className="text-foreground font-medium" />,
                }}
              />
            </p>
          </div>

          <div className="space-y-3">
            <Button
              variant="ghost"
              asChild
              className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link to="/auth/sign-in">{t("auth:checkEmail.backToLogin")}</Link>
            </Button>
          </div>
        </div>
      </AuthLayout>
    </>
  );
}

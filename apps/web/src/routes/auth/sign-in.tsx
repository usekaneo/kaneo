import PageTitle from "@/components/page-title";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "../../components/auth/layout";
import { SignInForm } from "../../components/auth/sign-in-form";
import { AuthToggle } from "../../components/auth/toggle";

export const Route = createFileRoute("/auth/sign-in")({
  component: SignIn,
});

function SignIn() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("auth.sign_in", { defaultValue: "Sign In" })} />
      <AuthLayout
        title={t("auth.welcome_back", { defaultValue: "Welcome back" })}
        subtitle={t("auth.enter_credentials", {
          defaultValue: "Enter your credentials to access your workspace",
        })}
      >
        <SignInForm />
        <AuthToggle
          message={t("auth.no_account", {
            defaultValue: "Don't have an account?",
          })}
          linkText={t("auth.create_account", {
            defaultValue: "Create Account",
          })}
          linkTo="/auth/sign-up"
        />
      </AuthLayout>
    </>
  );
}

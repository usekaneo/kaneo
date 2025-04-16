import { AuthLayout } from "@/components/auth/layout";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { AuthToggle } from "@/components/auth/toggle";
import PageTitle from "@/components/page-title";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUp,
});

function SignUp() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle
        title={t("auth.create_account", { defaultValue: "Create Account" })}
      />
      <AuthLayout
        title={t("auth.create_account", { defaultValue: "Create Account" })}
        subtitle={t("auth.get_started", {
          defaultValue: "Get started with your free workspace",
        })}
      >
        <SignUpForm />
        <AuthToggle
          message={t("auth.already_have_account", {
            defaultValue: "Already have an account?",
          })}
          linkText={t("auth.sign_in", { defaultValue: "Sign In" })}
          linkTo="/auth/sign-in"
        />
      </AuthLayout>
    </>
  );
}

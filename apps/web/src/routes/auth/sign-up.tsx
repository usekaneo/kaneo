import { AuthLayout } from "@/components/auth/layout";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { AuthToggle } from "@/components/auth/toggle";
import PageTitle from "@/components/page-title";
import { getConfig } from "@/fetchers/config/get-config";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUp,
  beforeLoad: async () => {
    const config = await getConfig();

    if (config.disableRegistration) {
      redirect({ to: "/auth/sign-in", replace: true });
    }
  },
});

function SignUp() {
  return (
    <>
      <PageTitle title="Create Account" />
      <AuthLayout
        title="Create account"
        subtitle="Get started with your free workspace"
      >
        <SignUpForm />
        <AuthToggle
          message="Already have an account?"
          linkText="Sign in"
          linkTo="/auth/sign-in"
        />
      </AuthLayout>
    </>
  );
}

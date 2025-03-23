import PageTitle from "@/components/page-title";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "../../components/auth/layout";
import { SignInForm } from "../../components/auth/sign-in-form";
import { AuthToggle } from "../../components/auth/toggle";

export const Route = createFileRoute("/auth/sign-in")({
  component: SignIn,
});

function SignIn() {
  return (
    <>
      <PageTitle title="Sign In" />
      <AuthLayout
        title="Welcome back"
        subtitle="Enter your credentials to access your workspace"
      >
        <SignInForm />
        <AuthToggle
          message="Don't have an account?"
          linkText="Create account"
          linkTo="/auth/sign-up"
        />
      </AuthLayout>
    </>
  );
}

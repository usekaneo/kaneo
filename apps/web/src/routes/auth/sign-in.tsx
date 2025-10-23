import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Github, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { AuthLayout } from "../../components/auth/layout";
import { MagicLinkSignInForm } from "../../components/auth/magic-link-sign-in-form";
import { SignInForm } from "../../components/auth/sign-in-form";
import { SignInFormSkeleton } from "../../components/auth/sign-in-form-skeleton";
import { AuthToggle } from "../../components/auth/toggle";

export const Route = createFileRoute("/auth/sign-in")({
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const lastLoginMethod = authClient.getLastUsedLoginMethod();
  const { data: config, isLoading: isConfigLoading } = useGetConfig();

  const handleGuestAccess = async () => {
    setIsGuestLoading(true);
    try {
      const result = await authClient.signIn.anonymous();
      if (result.error) {
        throw new Error(result.error.message);
      }
      toast.success("Signed in as guest");
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to sign in as guest",
      );
    } finally {
      setIsGuestLoading(false);
    }
  };

  const handleSignInGoogle = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: `${import.meta.env.VITE_CLIENT_URL}/dashboard`,
        errorCallbackURL: `${import.meta.env.VITE_CLIENT_URL}/auth/sign-in`,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      toast.success("Signed in with Google");
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to sign in as guest",
      );
    } finally {
      setIsGuestLoading(false);
    }
  };

  const handleSignInGithub = async () => {
    setIsGithubLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: "github",
        callbackURL: `${import.meta.env.VITE_CLIENT_URL}/dashboard`,
        errorCallbackURL: `${import.meta.env.VITE_CLIENT_URL}/auth/sign-in`,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      toast.success("Signed in with Github");
      navigate({ to: "/dashboard" });
      setIsGithubLoading(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to sign in with Github",
      );
    } finally {
      setIsGithubLoading(false);
    }
  };

  if (isConfigLoading) {
    return (
      <>
        <PageTitle title="Sign In" />
        <AuthLayout
          title="Welcome back"
          subtitle="Enter your credentials to access your workspace"
        >
          <SignInFormSkeleton />
        </AuthLayout>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Sign In" />
      <AuthLayout
        title="Welcome back"
        subtitle="Enter your credentials to access your workspace"
      >
        <div className="space-y-4 mt-6">
          <div className="flex flex-col gap-2">
            <div className="relative">
              {config?.hasGoogleSignIn && (
                <Button
                  variant="outline"
                  onClick={handleSignInGoogle}
                  disabled={isGoogleLoading}
                  className={cn(
                    "w-full mb-2",
                    lastLoginMethod === "google" && "!border-primary/50",
                  )}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <title>Google</title>
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  {isGoogleLoading ? "Signing in..." : "Continue with Google"}
                  {lastLoginMethod === "google" && (
                    <span className="absolute rounded-md -top-3 right-1 px-1.5 text-xs text-primary font-medium bg-sidebar border border-primary/50">
                      Last used
                    </span>
                  )}
                </Button>
              )}
              {config?.hasGithubSignIn && (
                <Button
                  variant="outline"
                  onClick={handleSignInGithub}
                  disabled={isGithubLoading}
                  className={cn(
                    "w-full",
                    lastLoginMethod === "github" && "!border-primary/50",
                  )}
                >
                  <Github className="w-4 h-4 mr-2" />
                  {isGithubLoading ? "Signing in..." : "Continue with GitHub"}
                  {lastLoginMethod === "github" && (
                    <span className="absolute rounded-md -top-3 right-1 px-1.5 text-xs text-primary font-medium bg-sidebar border border-primary/50">
                      Last used
                    </span>
                  )}
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              onClick={handleGuestAccess}
              disabled={isGuestLoading}
              className="w-full"
              size="sm"
            >
              <UserCheck className="w-4 h-4 mr-2" />
              {isGuestLoading ? "Signing in..." : "Continue as guest"}
            </Button>
          </div>
          <div className="flex items-center gap-4 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          {config?.hasSmtp ? <MagicLinkSignInForm /> : <SignInForm />}
          <AuthToggle
            message="Don't have an account?"
            linkText="Create account"
            linkTo="/auth/sign-up"
          />
        </div>
      </AuthLayout>
    </>
  );
}

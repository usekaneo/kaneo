import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Github, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AuthLayout } from "../../components/auth/layout";
import { SignInForm } from "../../components/auth/sign-in-form";
import { AuthToggle } from "../../components/auth/toggle";

export const Route = createFileRoute("/auth/sign-in")({
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const lastLoginMethod = authClient.getLastUsedLoginMethod();

  console.log(lastLoginMethod === "github");

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

  const handleSignInGithub = async () => {
    setIsGithubLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: "github",
        callbackURL: `${window.location.origin}/api/auth/callback/github`,
        errorCallbackURL: `${window.location.origin}/auth/sign-in`,
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
          <SignInForm />
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

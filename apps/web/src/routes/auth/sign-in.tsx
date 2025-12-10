import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Github, KeyRound, UserCheck } from "lucide-react";
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
  const [isCustomOAuthLoading, setIsCustomOAuthLoading] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isDiscordLoading, setIsDiscordLoading] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
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

  const handleCustomOAuth = async () => {
    setIsCustomOAuthLoading(true);
    try {
      const result = await authClient.signIn.oauth2({
        providerId: "custom",
        callbackURL: `${import.meta.env.VITE_CLIENT_URL}/dashboard`,
        errorCallbackURL: `${import.meta.env.VITE_CLIENT_URL}/auth/sign-in`,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      toast.success("Signed in with OIDC");
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to sign in with OIDC",
      );
    } finally {
      setIsCustomOAuthLoading(false);
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
        error instanceof Error
          ? error.message
          : "Failed to sign in with Google",
      );
    } finally {
      setIsGoogleLoading(false);
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

  const handleSignInDiscord = async () => {
    setIsDiscordLoading(true);
    try {
      const result = await authClient.signIn.social({
        provider: "discord",
        callbackURL: `${import.meta.env.VITE_CLIENT_URL}/dashboard`,
        errorCallbackURL: `${import.meta.env.VITE_CLIENT_URL}/auth/sign-in`,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      toast.success("Signed in with Discord");
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to sign in with Discord",
      );
    } finally {
      setIsDiscordLoading(false);
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
        <div className="mt-6">
          {(config?.hasGoogleSignIn ||
            config?.hasGithubSignIn ||
            config?.hasDiscordSignIn ||
            config?.hasCustomOAuth) && (
            <>
              <div className="space-y-3">
                {config?.hasGoogleSignIn && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={handleSignInGoogle}
                      disabled={isGoogleLoading}
                      className={cn(
                        "w-full",
                        lastLoginMethod === "google" && "border-primary/50!",
                      )}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="w-5 h-5 mr-2"
                        aria-label="Google"
                      >
                        <title>Google</title>
                        <path
                          d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                          fill="currentColor"
                        />
                      </svg>
                      {isGoogleLoading
                        ? "Signing in..."
                        : "Continue with Google"}
                    </Button>
                    {lastLoginMethod === "google" && (
                      <span className="absolute rounded-md -top-3 right-1 px-1.5 text-xs text-primary font-medium bg-sidebar border border-primary/50">
                        Last used
                      </span>
                    )}
                  </div>
                )}

                {config?.hasGithubSignIn && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={handleSignInGithub}
                      disabled={isGithubLoading}
                      className={cn(
                        "w-full",
                        lastLoginMethod === "github" && "border-primary/50!",
                      )}
                    >
                      <Github className="w-5 h-5 mr-2" />
                      {isGithubLoading
                        ? "Signing in..."
                        : "Continue with GitHub"}
                    </Button>
                    {lastLoginMethod === "github" && (
                      <span className="absolute rounded-md -top-3 right-1 px-1.5 text-xs text-primary font-medium bg-sidebar border border-primary/50">
                        Last used
                      </span>
                    )}
                  </div>
                )}

                {config?.hasDiscordSignIn && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={handleSignInDiscord}
                      disabled={isDiscordLoading}
                      className={cn(
                        "w-full",
                        lastLoginMethod === "discord" && "border-primary/50!",
                      )}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="w-5 h-5 mr-2"
                        fill="currentColor"
                        aria-label="Discord"
                      >
                        <title>Discord</title>
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                      </svg>
                      {isDiscordLoading
                        ? "Signing in..."
                        : "Continue with Discord"}
                    </Button>
                    {lastLoginMethod === "discord" && (
                      <span className="absolute rounded-md -top-3 right-1 px-1.5 text-xs text-primary font-medium bg-sidebar border border-primary/50">
                        Last used
                      </span>
                    )}
                  </div>
                )}

                {config?.hasCustomOAuth && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={handleCustomOAuth}
                      disabled={isCustomOAuthLoading}
                      className={cn(
                        "w-full",
                        lastLoginMethod === "custom" && "border-primary/50!",
                      )}
                    >
                      <KeyRound className="w-5 h-5 mr-2" />
                      {isCustomOAuthLoading
                        ? "Signing in..."
                        : "Continue with OIDC"}
                    </Button>
                    {lastLoginMethod === "custom" && (
                      <span className="absolute rounded-md -top-3 right-1 px-1.5 text-xs text-primary font-medium bg-sidebar border border-primary/50">
                        Last used
                      </span>
                    )}
                  </div>
                )}

                {config?.hasGuestAccess && (
                  <Button
                    variant="outline"
                    onClick={handleGuestAccess}
                    disabled={isGuestLoading}
                    className="w-full"
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    {isGuestLoading ? "Signing in..." : "Continue as guest"}
                  </Button>
                )}
              </div>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-card text-muted-foreground">or</span>
                </div>
              </div>
            </>
          )}
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

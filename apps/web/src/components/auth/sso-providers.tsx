import { Github, KeyRound } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { GetConfigResponse } from "@/fetchers/config/get-config";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

type Props = {
  config: GetConfigResponse | undefined;
  callbackURL: string;
  errorCallbackURL: string;
  lastLoginMethod?: string | null;
};

export function SSOProviders({
  config,
  callbackURL,
  errorCallbackURL,
  lastLoginMethod,
}: Props) {
  const { t } = useTranslation();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleSocial = async (
    provider: "google" | "github" | "discord",
    errorKey: string,
  ) => {
    setLoadingProvider(provider);
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL,
        errorCallbackURL,
      });
      if (result.error) throw new Error(result.error.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(errorKey));
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleCustomOAuth = async () => {
    setLoadingProvider("custom");
    try {
      const result = await authClient.signIn.oauth2({
        providerId: "custom",
        callbackURL,
        errorCallbackURL,
      });
      if (result.error) throw new Error(result.error.message);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("auth:signIn.oidcError"),
      );
    } finally {
      setLoadingProvider(null);
    }
  };

  const hasAny =
    config?.hasGoogleSignIn ||
    config?.hasGithubSignIn ||
    config?.hasDiscordSignIn ||
    config?.hasCustomOAuth;

  if (!hasAny) return null;

  return (
    <div className="space-y-3">
      {config?.hasGoogleSignIn && (
        <ProviderButton
          providerId="google"
          isLoading={loadingProvider === "google"}
          isLastUsed={lastLoginMethod === "google"}
          onClick={() => handleSocial("google", "auth:signIn.googleError")}
          label={t("auth:signIn.continueWithGoogle")}
          loadingLabel={t("auth:signIn.signingIn")}
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-5 h-5 mr-2"
              aria-label={t("auth:providers.google")}
            >
              <title>Google</title>
              <path
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                fill="currentColor"
              />
            </svg>
          }
        />
      )}
      {config?.hasGithubSignIn && (
        <ProviderButton
          providerId="github"
          isLoading={loadingProvider === "github"}
          isLastUsed={lastLoginMethod === "github"}
          onClick={() => handleSocial("github", "auth:signIn.githubError")}
          label={t("auth:signIn.continueWithGithub")}
          loadingLabel={t("auth:signIn.signingIn")}
          icon={<Github className="w-5 h-5 mr-2" />}
        />
      )}
      {config?.hasDiscordSignIn && (
        <ProviderButton
          providerId="discord"
          isLoading={loadingProvider === "discord"}
          isLastUsed={lastLoginMethod === "discord"}
          onClick={() => handleSocial("discord", "auth:signIn.discordError")}
          label={t("auth:signIn.continueWithDiscord")}
          loadingLabel={t("auth:signIn.signingIn")}
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-5 h-5 mr-2"
              fill="currentColor"
              aria-label={t("auth:providers.discord")}
            >
              <title>Discord</title>
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          }
        />
      )}
      {config?.hasCustomOAuth && (
        <ProviderButton
          providerId="custom"
          isLoading={loadingProvider === "custom"}
          isLastUsed={lastLoginMethod === "custom"}
          onClick={handleCustomOAuth}
          label={t("auth:signIn.continueWithOidc")}
          loadingLabel={t("auth:signIn.signingIn")}
          icon={<KeyRound className="w-5 h-5 mr-2" />}
        />
      )}
    </div>
  );
}

function ProviderButton({
  providerId,
  icon,
  label,
  loadingLabel,
  isLoading,
  isLastUsed,
  onClick,
}: {
  providerId: string;
  icon: React.ReactNode;
  label: string;
  loadingLabel: string;
  isLoading: boolean;
  isLastUsed: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={onClick}
        disabled={isLoading}
        className={cn("w-full", isLastUsed && "border-primary/50!")}
        data-provider={providerId}
      >
        {icon}
        {isLoading ? loadingLabel : label}
      </Button>
      {isLastUsed && (
        <span className="absolute rounded-md -top-3 right-1 px-1.5 text-xs text-primary font-medium bg-sidebar border border-primary/50">
          {t("auth:signIn.lastUsed")}
        </span>
      )}
    </div>
  );
}

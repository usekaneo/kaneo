import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";
import type { AuthCaptcha } from "./use-auth-captcha";

export function useGuestSignIn(captcha: AuthCaptcha, onSuccess: () => void) {
  const { t } = useTranslation();
  const [isPending, setIsPending] = useState(false);

  const signIn = async () => {
    if (captcha.pending) return;
    setIsPending(true);
    try {
      const result = await authClient.signIn.anonymous(
        {},
        { headers: captcha.headers },
      );
      if (result.error) throw new Error(result.error.message);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("auth:signIn.guestError"),
      );
      setIsPending(false);
      captcha.reset();
    }
  };

  return { isPending, signIn };
}

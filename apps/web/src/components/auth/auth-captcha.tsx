import { useTranslation } from "react-i18next";
import { authMessageClassName } from "./auth-form-styles";
import { authLinkClassName } from "./auth-link-class";
import { Turnstile } from "./turnstile";
import type { AuthCaptcha as AuthCaptchaState } from "./use-auth-captcha";

export function AuthCaptcha({ captcha }: { captcha: AuthCaptchaState }) {
  const { t } = useTranslation();

  if (!captcha.siteKey) return null;

  return (
    <div className="flex flex-col gap-2">
      <Turnstile
        key={captcha.key}
        siteKey={captcha.siteKey}
        onVerify={captcha.onVerify}
        onExpire={captcha.onExpire}
        onError={captcha.onError}
      />
      {captcha.failed ? (
        <p role="alert" className={authMessageClassName}>
          {t("auth:forms.captchaFailed")}{" "}
          <button
            type="button"
            className={authLinkClassName}
            onClick={captcha.reset}
          >
            {t("auth:forms.captchaRetry")}
          </button>
        </p>
      ) : captcha.pending ? (
        <p
          role="status"
          className="delayed-reveal text-[13px] text-muted-foreground leading-[18px] [animation-delay:1.5s]"
        >
          {t("auth:forms.captchaChecking")}
        </p>
      ) : null}
    </div>
  );
}

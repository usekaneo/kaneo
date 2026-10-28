import { Turnstile } from "./turnstile";
import type { AuthCaptcha as AuthCaptchaState } from "./use-auth-captcha";

export function AuthCaptcha({ captcha }: { captcha: AuthCaptchaState }) {
  if (!captcha.siteKey) return null;

  return (
    <Turnstile
      key={captcha.key}
      siteKey={captcha.siteKey}
      onVerify={captcha.onVerify}
      onExpire={captcha.onExpire}
      onError={captcha.onExpire}
    />
  );
}

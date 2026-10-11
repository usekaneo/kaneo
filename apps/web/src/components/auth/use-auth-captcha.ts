import { useCallback, useState } from "react";
import { getTurnstileSiteKey } from "./turnstile-site-key";

export function useAuthCaptcha() {
  const siteKey = getTurnstileSiteKey();
  const [token, setToken] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const clear = useCallback(() => setToken(null), []);
  const reset = useCallback(() => {
    setToken(null);
    setKey((value) => value + 1);
  }, []);

  return {
    siteKey,
    key,
    pending: Boolean(siteKey) && !token,
    headers: token ? { "x-turnstile-token": token } : undefined,
    onVerify: setToken,
    onExpire: clear,
    reset,
  };
}

export type AuthCaptcha = ReturnType<typeof useAuthCaptcha>;

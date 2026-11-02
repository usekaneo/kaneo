import { useCallback, useState } from "react";
import { getTurnstileSiteKey } from "./turnstile-site-key";

export function useAuthCaptcha() {
  const siteKey = getTurnstileSiteKey();
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [key, setKey] = useState(0);
  const clear = useCallback(() => setToken(null), []);
  const fail = useCallback(() => {
    setToken(null);
    setFailed(true);
  }, []);
  const reset = useCallback(() => {
    setToken(null);
    setFailed(false);
    setKey((value) => value + 1);
  }, []);

  return {
    siteKey,
    key,
    pending: Boolean(siteKey) && !token,
    failed,
    headers: token ? { "x-turnstile-token": token } : undefined,
    onVerify: setToken,
    onExpire: clear,
    onError: fail,
    reset,
  };
}

export type AuthCaptcha = ReturnType<typeof useAuthCaptcha>;

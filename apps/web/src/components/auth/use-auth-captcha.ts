import { useCallback, useState } from "react";

export function useAuthCaptcha() {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
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

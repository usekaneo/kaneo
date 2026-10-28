const publicEnv: { turnstileSiteKey: string | undefined } = {
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
};

export function getTurnstileSiteKey() {
  return publicEnv.turnstileSiteKey || undefined;
}

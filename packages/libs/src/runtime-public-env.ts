export type KaneoRuntimePublicConfig = {
  VITE_API_URL?: string;
  VITE_CLIENT_URL?: string;
};

declare global {
  interface Window {
    __KANEO_RUNTIME_CONFIG__?: KaneoRuntimePublicConfig;
  }
}

function readRuntime(key: keyof KaneoRuntimePublicConfig): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  const raw = window.__KANEO_RUNTIME_CONFIG__?.[key];
  return typeof raw === "string" && raw.trim() !== "" ? raw : undefined;
}

/**
 * In Docker, `env.sh` maps `KANEO_API_URL` / `KANEO_CLIENT_URL` into
 * `window.__KANEO_RUNTIME_CONFIG__` before the SPA loads so the browser uses the public URL
 * (for example HTTPS behind a reverse proxy) instead of an internal build-time or sed value.
 */
export function resolvePublicEnvVar(
  key: keyof KaneoRuntimePublicConfig,
  buildValue: string | undefined,
): string | undefined {
  return readRuntime(key) ?? buildValue;
}

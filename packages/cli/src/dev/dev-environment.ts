import { parseEnv } from "node:util";
import type { Environment } from "../render/capabilities.js";

/** The API's own default when the root `.env` doesn't set `KANEO_API_URL`. */
export const DEFAULT_DEV_API_URL = "http://localhost:1337";

/** The address the dev API reports for itself, from the root `.env` text. */
export function devApiUrl(dotenv: string | undefined): string {
  const value =
    dotenv === undefined ? undefined : parseEnv(dotenv).KANEO_API_URL;
  return value?.trim() || DEFAULT_DEV_API_URL;
}

// Source runs keep their own login and talk to the dev API, whatever the
// shell exports for the CLI.
export function devEnvironment(
  env: Environment,
  configPath: string,
  apiUrl: string,
): Environment {
  return {
    ...env,
    KANEO_CONFIG: configPath,
    KANEO_API_URL: apiUrl,
    KANEO_API_KEY: "",
    KANEO_WEB_URL: "",
  };
}

import { isBillingEnabled } from "../config";

export const TOLT_API_BASE_URL = "https://platform.tolt.dev";

export function toltApiKey() {
  return process.env.TOLT_API_KEY ?? "";
}

export function isToltEnabled() {
  return Boolean(
    isBillingEnabled() &&
    process.env.TOLT_API_KEY &&
    process.env.TOLT_PUBLIC_KEY,
  );
}

export function toltPublicKey(): string | null {
  return isToltEnabled() ? (process.env.TOLT_PUBLIC_KEY ?? null) : null;
}

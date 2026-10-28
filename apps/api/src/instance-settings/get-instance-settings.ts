import { readStoredSettings } from "./read-stored-settings";
import {
  type InstanceSettings,
  resolveInstanceSettings,
  type StoredInstanceSettings,
} from "./resolve-instance-settings";

// Other API instances pick up a change within this window; Redis stays optional.
const CACHE_MS = 5_000;

let cached: {
  expiresAt: number;
  value: Promise<StoredInstanceSettings>;
} | null = null;

/** The effective instance settings. Environment variables win over the database. */
export async function getInstanceSettings(): Promise<InstanceSettings> {
  const now = Date.now();
  if (!cached || cached.expiresAt <= now) {
    const value = readStoredSettings();
    cached = { expiresAt: now + CACHE_MS, value };
    // Don't keep a failed read around.
    value.catch(() => {
      if (cached?.value === value) cached = null;
    });
  }
  return resolveInstanceSettings(await cached.value, process.env);
}

export function invalidateInstanceSettings() {
  cached = null;
}

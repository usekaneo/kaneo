/**
 * Durable visitor device id (layer-2 identity, instance-opt-in).
 *
 * Lives in the HOST page's localStorage, so it is first-party to the
 * embedding site and persists across visits; it is never set unless the
 * instance's server config enables device tracking. When storage is blocked
 * (private mode, permissions) the widget stays cookieless.
 */

const DEVICE_KEY = "quackback:device-id";

export function getOrCreateDeviceId(): string | null {
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function clearDeviceId(): void {
  try {
    window.localStorage.removeItem(DEVICE_KEY);
  } catch {
    // Storage blocked: nothing was stored.
  }
}

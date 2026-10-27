type Translate = (key: string, values?: Record<string, unknown>) => string;

type Device = { browser: string | null; os: string | null };

/** "Firefox on Linux", or whichever half is known. */
export function getSessionDeviceLabel({ browser, os }: Device, t: Translate) {
  if (browser && os) return t("settings:sessions.device", { browser, os });
  return browser ?? os ?? t("settings:sessions.unknownDevice");
}

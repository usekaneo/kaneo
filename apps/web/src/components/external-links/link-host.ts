export function linkHost(url: string) {
  try {
    const parsed = new URL(url);
    // App links such as obsidian://open?... have no meaningful host, so show
    // the app's scheme instead.
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return parsed.protocol.slice(0, -1);
    }
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

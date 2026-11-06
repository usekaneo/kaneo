export function getEmbedSource(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be"
    ) {
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      const videoId =
        host === "youtu.be"
          ? pathParts[0]
          : parsed.searchParams.get("v") ||
            (pathParts[0] === "shorts" ? pathParts[1] : null) ||
            (pathParts[0] === "live" ? pathParts[1] : null);
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

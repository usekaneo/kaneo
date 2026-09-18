import { assertPublicDestination } from "../utils/assert-public-destination";

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
  /** Set for YouTube links so the client can embed the player. */
  youtubeId: string | null;
};

const TIMEOUT_MS = 5_000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const CACHE_SIZE = 500;
const CACHE_MS = 6 * 60 * 60_000;
const FAILURE_CACHE_MS = 10 * 60_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; KaneoLinkPreview/1.0; +https://kaneo.app)";

// Map keeps insertion order, so the oldest entry is the first key.
const cache = new Map<
  string,
  { at: number; ttl: number; value: LinkPreview | null }
>();

function remember(url: string, value: LinkPreview | null, ttl: number) {
  cache.delete(url);
  cache.set(url, { at: Date.now(), ttl, value });
  while (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function youtubeIdOf(url: URL) {
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0] ?? null;
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/);
      id = match?.[1] ?? null;
    }
  }
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

/** GET with a public-address check before every hop, a timeout and a size cap. */
async function safeFetch(start: string, accept: string) {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicDestination(current, "Link");
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT, Accept: accept },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) return null;
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      return null;
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
    await reader.cancel().catch(() => {});
    return {
      url: current,
      contentType: response.headers.get("content-type") ?? "",
      text: new TextDecoder().decode(
        Buffer.concat(chunks).subarray(0, MAX_BYTES),
      ),
    };
  }
  return null;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decode(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(
      /&([a-z]+);/gi,
      (match, name) => ENTITIES[name.toLowerCase()] ?? match,
    )
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string) {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  return match ? (match[2] ?? match[3] ?? match[4] ?? null) : null;
}

/** The bits of <head> a preview needs. Regexes are enough for meta tags. */
export function parseHtml(html: string, pageUrl: string) {
  const head = html.slice(0, html.search(/<\/head>/i) + 1 || html.length);
  const meta = new Map<string, string>();
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, "property") ?? attr(tag, "name"))?.toLowerCase();
    const content = attr(tag, "content");
    if (key && content && !meta.has(key)) meta.set(key, decode(content));
  }
  let favicon: string | null = null;
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, "rel")?.toLowerCase() ?? "";
    const href = attr(tag, "href");
    if (href && /\bicon\b/.test(rel)) {
      favicon = decode(href);
      if (rel.includes("apple")) continue;
      break;
    }
  }
  const titleTag = head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];

  const absolute = (value: string | null | undefined) => {
    if (!value) return null;
    try {
      const url = new URL(value, pageUrl);
      return url.protocol === "https:" || url.protocol === "http:"
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  };
  const clip = (value: string | null | undefined, max: number) =>
    value ? (value.length > max ? `${value.slice(0, max - 1)}…` : value) : null;

  return {
    title: clip(
      meta.get("og:title") ??
        meta.get("twitter:title") ??
        (titleTag ? decode(titleTag) : null),
      200,
    ),
    description: clip(
      meta.get("og:description") ??
        meta.get("twitter:description") ??
        meta.get("description"),
      300,
    ),
    image: absolute(
      meta.get("og:image:secure_url") ??
        meta.get("og:image") ??
        meta.get("twitter:image") ??
        meta.get("twitter:image:src"),
    ),
    siteName: clip(meta.get("og:site_name"), 80),
    favicon: absolute(favicon ?? "/favicon.ico"),
  };
}

async function youtubePreview(url: URL, id: string): Promise<LinkPreview> {
  // oEmbed gives the real title without scraping the heavy watch page.
  const oembed = await safeFetch(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${id}`,
    )}`,
    "application/json",
  ).catch(() => null);
  let title: string | null = null;
  let author: string | null = null;
  try {
    const data = oembed ? JSON.parse(oembed.text) : null;
    title = typeof data?.title === "string" ? data.title : null;
    author = typeof data?.author_name === "string" ? data.author_name : null;
  } catch {}
  return {
    url: url.toString(),
    title,
    description: author,
    image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    siteName: "YouTube",
    favicon: "https://www.youtube.com/favicon.ico",
    youtubeId: id,
  };
}

export async function getLinkPreview(raw: string): Promise<LinkPreview | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.hash = "";
  const key = url.toString();

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;

  try {
    const youtubeId = youtubeIdOf(url);
    const preview = youtubeId
      ? await youtubePreview(url, youtubeId)
      : await (async () => {
          const page = await safeFetch(
            key,
            "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          );
          if (!page || !/html/i.test(page.contentType)) return null;
          const parsed = parseHtml(page.text, page.url);
          if (!parsed.title && !parsed.description && !parsed.image) {
            return null;
          }
          return { url: key, ...parsed, youtubeId: null };
        })();
    remember(key, preview, preview ? CACHE_MS : FAILURE_CACHE_MS);
    return preview;
  } catch {
    // Unreachable, private, slow or malformed: no preview, and don't retry
    // on every render.
    remember(key, null, FAILURE_CACHE_MS);
    return null;
  }
}

export type ImageRef = {
  readonly url: string;
  readonly alt: string;
};

type Found = ImageRef & { readonly index: number };

const FENCE = /^\s{0,3}(`{3,}|~{3,})/u;
const INLINE_CODE = /(`+)[\s\S]*?\1/gu;
const COMMENT = /<!--[\s\S]*?-->/gu;
const MARKDOWN_IMAGE =
  /!\[((?:\\[\s\S]|[^\\\]])*)\]\(\s*(<[^>\n]*>|(?:[^\s()]|\([^\s()]*\))+)(?:\s+(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'))?\s*\)/gu;
const IMG_TAG = /<img\b[^>]*>/giu;
const ATTACHMENT_TAG = /<kaneo-attachment\b[^>]*>/giu;
const LINKABLE = /^(?:https?:\/\/|\/)/iu;
const IMAGE_EXTENSION = /\.(?:apng|avif|gif|heic|heif|jpe?g|png|webp)$/iu;
const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]+);/giu,
    (whole, name: string) => {
      const code = /^#x/iu.test(name)
        ? Number.parseInt(name.slice(2), 16)
        : name.startsWith("#")
          ? Number(name.slice(1))
          : Number.NaN;
      if (Number.isInteger(code) && code > 0 && code <= 0x10ffff) {
        return String.fromCodePoint(code);
      }
      return ENTITIES[name.toLowerCase()] ?? whole;
    },
  );
}

function attribute(tag: string, name: string): string {
  const match = new RegExp(
    `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>/]+))`,
    "iu",
  ).exec(tag);
  return decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
}

function withoutCode(markdown: string): string {
  let fence: string | null = null;
  const kept: string[] = [];
  for (const line of markdown.replace(/\r\n?/gu, "\n").split("\n")) {
    if (fence !== null) {
      if (line.trim().startsWith(fence)) fence = null;
      kept.push("");
      continue;
    }
    const start = FENCE.exec(line);
    if (start) {
      fence = start[1] ?? "```";
      kept.push("");
      continue;
    }
    kept.push(line);
  }
  return kept.join("\n").replace(COMMENT, "").replace(INLINE_CODE, "");
}

function markdownUrl(destination: string): string {
  return destination.startsWith("<")
    ? destination.slice(1, -1).trim()
    : destination;
}

function unescapeMarkdown(text: string): string {
  return text.replace(/\\([\p{P}\p{S}])/gu, "$1");
}

function isImageAttachment(tag: string): boolean {
  const mimeType = attribute(tag, "mime-type").toLowerCase();
  if (mimeType !== "") return mimeType.startsWith("image/");
  return IMAGE_EXTENSION.test(attribute(tag, "filename"));
}

export function extractImages(markdown: string): ImageRef[] {
  const text = withoutCode(markdown);
  const found: Found[] = [];
  for (const match of text.matchAll(MARKDOWN_IMAGE)) {
    found.push({
      index: match.index,
      url: markdownUrl(match[2] ?? ""),
      alt: unescapeMarkdown(match[1] ?? "").trim(),
    });
  }
  for (const match of text.matchAll(IMG_TAG)) {
    found.push({
      index: match.index,
      url: attribute(match[0], "src"),
      alt: attribute(match[0], "alt"),
    });
  }
  for (const match of text.matchAll(ATTACHMENT_TAG)) {
    if (!isImageAttachment(match[0])) continue;
    found.push({
      index: match.index,
      url: attribute(match[0], "url"),
      alt: attribute(match[0], "filename"),
    });
  }
  const seen = new Set<string>();
  return found
    .sort((a, b) => a.index - b.index)
    .filter(({ url }) => {
      if (!LINKABLE.test(url) || seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .map(({ url, alt }) => ({ url, alt }));
}

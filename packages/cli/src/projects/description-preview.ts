const BLOCK_BREAK =
  /<\s*(?:br\s*\/?|\/\s*(?:p|div|li|h[1-6]|blockquote|pre|tr))\s*>/giu;
const TAG = /<[^>]+>/gu;
const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

export function plainText(value: string): string {
  const looksLikeHtml = /<\/?[a-z][^>]*>/iu.test(value);
  const text = looksLikeHtml
    ? value
        .replace(BLOCK_BREAK, "\n")
        .replace(TAG, "")
        .replace(
          /&(?:amp|lt|gt|quot|#39|nbsp);/gu,
          (entity) => ENTITIES[entity] ?? entity,
        )
    : value;
  return text.replace(/\r\n?/gu, "\n");
}

export type DescriptionPreview = {
  readonly lines: ReadonlyArray<string>;
  readonly more: boolean;
};

export function descriptionPreview(
  description: string | null,
  maxLines = 5,
): DescriptionPreview {
  if (!description) return { lines: [], more: false };
  const lines: string[] = [];
  for (const raw of plainText(description).split("\n")) {
    const line = raw.replace(/\s+/gu, " ").trim();
    if (line === "" && (lines.length === 0 || lines.at(-1) === "")) continue;
    lines.push(line);
  }
  while (lines.at(-1) === "") lines.pop();
  return { lines: lines.slice(0, maxLines), more: lines.length > maxLines };
}

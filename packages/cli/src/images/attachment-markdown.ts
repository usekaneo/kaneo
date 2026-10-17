export type UploadedFile = {
  readonly name: string;
  readonly url: string;
  readonly contentType: string;
  readonly size: number;
  readonly kind: "image" | "attachment";
};

export function altTextFor(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/u, "")
    .replace(/[-_]+/gu, " ")
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/"/gu, "&quot;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;");
}

function escapeMarkdownText(value: string): string {
  return value.replace(/[\\[\]]/gu, (character) => `\\${character}`);
}

function formatMarkdownUrl(value: string): string {
  if (!/[\s<>]/u.test(value)) return value;
  return `<${value.replace(/[<>]/gu, encodeURIComponent)}>`;
}

export function fileMarkdown(file: UploadedFile): string {
  if (file.kind === "image") {
    return `![${escapeMarkdownText(altTextFor(file.name))}](${formatMarkdownUrl(file.url)})`;
  }
  return `<kaneo-attachment url="${escapeHtml(file.url)}" filename="${escapeHtml(file.name)}" mime-type="${escapeHtml(file.contentType)}" size="${file.size}" />`;
}

export function appendToDescription(
  current: string | null,
  files: ReadonlyArray<UploadedFile>,
): string {
  const added = files.map(fileMarkdown).join("\n\n");
  const existing = (current ?? "").replace(/\s+$/u, "");
  return existing === "" ? added : `${existing}\n\n${added}`;
}

export function commentWithFiles(
  message: string,
  files: ReadonlyArray<UploadedFile>,
): string {
  return [message.trim(), ...files.map(fileMarkdown)]
    .filter((part) => part !== "")
    .join("\n\n");
}

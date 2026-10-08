import { imageInfo } from "./image-info.js";

const INLINE_IMAGE_TYPES = new Set([
  "image/apng",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const TYPES_BY_EXTENSION: Readonly<Record<string, string>> = {
  apng: "image/apng",
  avif: "image/avif",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  json: "application/json",
  zip: "application/zip",
  gz: "application/gzip",
  csv: "text/csv",
  md: "text/markdown",
  txt: "text/plain",
  log: "text/plain",
  html: "text/html",
  xml: "application/xml",
  yaml: "application/yaml",
  yml: "application/yaml",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const SNIFFED_TYPES = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
} as const;

export function isInlineImageType(contentType: string): boolean {
  return INLINE_IMAGE_TYPES.has(contentType.toLowerCase());
}

export function contentTypeFor(filename: string, bytes: Uint8Array): string {
  const format = imageInfo(bytes).format;
  if (format in SNIFFED_TYPES) {
    return SNIFFED_TYPES[format as keyof typeof SNIFFED_TYPES];
  }
  const extension = /\.([^./\\]+)$/u.exec(filename)?.[1]?.toLowerCase() ?? "";
  return TYPES_BY_EXTENSION[extension] ?? "application/octet-stream";
}

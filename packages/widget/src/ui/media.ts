import { isSafeHttpUrl } from "../core/options.js";

export const MAX_ATTACHMENTS = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function imageFileError(file: File): string | undefined {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    return "Choose a PNG, JPEG, or WebP image.";
  if (!file.size || file.size > MAX_IMAGE_BYTES)
    return "Each image must be between 1 byte and 5 MB.";
}

export async function validateImage(file: File) {
  const error = imageFileError(file);
  if (error) throw new Error(error);
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const png = bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (
    !(
      (file.type === "image/png" && png) ||
      (file.type === "image/jpeg" && jpeg) ||
      (file.type === "image/webp" && webp)
    )
  )
    throw new Error("This file does not contain the selected image format.");
}

export function safeMediaUrl(value?: string, allowBlob = false) {
  if (
    value &&
    (isSafeHttpUrl(value) || (allowBlob && value.startsWith("blob:")))
  )
    return value;
}

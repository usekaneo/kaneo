import createImageUpload, {
  finalizeImageUpload,
} from "@/fetchers/task/create-image-upload";

const allowedImageMimeTypes = new Set([
  "image/apng",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

type UploadSurface = "description" | "comment";

export function isSupportedImageFile(file: File) {
  return allowedImageMimeTypes.has(file.type.toLowerCase());
}

export function isSupportedTaskAsset(file: File) {
  return file.size > 0;
}

export function getImageAltText(filename: string) {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

export async function uploadTaskImage({
  taskId,
  surface,
  file,
}: {
  taskId: string;
  surface: UploadSurface;
  file: File;
}) {
  if (!isSupportedImageFile(file)) {
    if (!isSupportedTaskAsset(file)) {
      throw new Error("Only non-empty file uploads are supported.");
    }
  }

  const upload = await createImageUpload({
    taskId,
    filename: file.name || "image",
    contentType: file.type,
    size: file.size,
    surface,
  });

  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error("Failed to upload file to storage.");
  }

  const asset = await finalizeImageUpload({
    taskId,
    key: upload.key,
    filename: file.name || "image",
    contentType: file.type,
    size: file.size,
    surface,
  });

  return {
    url: asset.url,
    alt: getImageAltText(file.name || "image"),
    filename: file.name || "file",
    kind: isSupportedImageFile(file) ? "image" : "attachment",
    mimeType: file.type,
    size: file.size,
  };
}

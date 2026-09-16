export const AVATAR_OUTPUT_SIZE = 256;
export const MAX_AVATAR_SOURCE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_AVATAR_TYPES = "image/*";

const SUPPORTED_OUTPUT_TYPES = ["image/webp", "image/png"] as const;

export type PreparedAvatar = {
  contentType: string;
  data: string;
};

function isSupportedOutputType(type: string) {
  return (SUPPORTED_OUTPUT_TYPES as readonly string[]).includes(type);
}

export function getCoverCropRect(width: number, height: number) {
  const side = Math.min(width, height);

  return {
    sourceX: Math.round((width - side) / 2),
    sourceY: Math.round((height - side) / 2),
    side,
  };
}

async function decodeImage(file: File) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("The image could not be read."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, 0.9);
  });
}

async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] as number);
  }

  return btoa(binary);
}

export async function prepareAvatarImage(file: File): Promise<PreparedAvatar> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }

  if (file.size > MAX_AVATAR_SOURCE_BYTES) {
    throw new Error("Choose an image smaller than 10MB.");
  }

  const source = await decodeImage(file);
  const width = "width" in source ? source.width : 0;
  const height = "height" in source ? source.height : 0;

  if (!width || !height) {
    throw new Error("The image could not be read.");
  }

  const { sourceX, sourceY, side } = getCoverCropRect(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("The image could not be processed.");
  }

  context.imageSmoothingQuality = "high";
  context.drawImage(
    source as CanvasImageSource,
    sourceX,
    sourceY,
    side,
    side,
    0,
    0,
    AVATAR_OUTPUT_SIZE,
    AVATAR_OUTPUT_SIZE,
  );

  if ("close" in source) {
    source.close();
  }

  const blob =
    (await toBlob(canvas, "image/webp")) ?? (await toBlob(canvas, "image/png"));

  if (!blob || !isSupportedOutputType(blob.type)) {
    throw new Error("The image could not be processed.");
  }

  return {
    contentType: blob.type,
    data: await blobToBase64(blob),
  };
}

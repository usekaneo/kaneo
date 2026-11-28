import * as ImagePicker from "expo-image-picker";

import { i18n } from "./i18n";
import { ApiError, resolveUrl } from "./api/client";
import { api } from "./api/endpoints";
import { sessionStore } from "./session";

export async function pickImage(
  options: { base64?: boolean; square?: boolean } = {},
) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    base64: options.base64,
    allowsEditing: options.square,
    aspect: options.square ? [1, 1] : undefined,
  });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
}

/**
 * Uploads a picked image through Kaneo's presigned flow (create, PUT to storage, finalize) and
 * returns Markdown for it. Requires object storage on the server.
 */
export async function uploadTaskImage(
  taskId: string,
  surface: "description" | "comment",
): Promise<string | null> {
  const image = await uploadTaskImageAsset(taskId, surface);
  return image ? `![${image.alt}](${image.url})` : null;
}

export async function uploadTaskImageAsset(
  taskId: string,
  surface: "description" | "comment",
): Promise<{ url: string; alt: string } | null> {
  const asset = await pickImage();
  if (!asset) return null;
  const contentType = asset.mimeType ?? "image/jpeg";
  const filename =
    asset.fileName ?? `image.${contentType.split("/")[1] ?? "jpg"}`;
  const blob = await (await fetch(asset.uri)).blob();
  const size = asset.fileSize ?? blob.size;

  const upload = await api.createImageUpload(taskId, {
    filename,
    contentType,
    size,
    surface,
  });
  const serverUrl = sessionStore.get().session?.serverUrl ?? "";
  // Presigned storage URLs must not receive Kaneo credentials, so this is a bare request.
  const put = await fetch(resolveUrl(serverUrl, upload.uploadUrl)!, {
    method: "PUT",
    headers: { "Content-Type": contentType, ...upload.headers },
    body: blob,
  });
  if (!put.ok)
    throw new ApiError(
      i18n.t("mobile:errors.uploadFailed", { status: put.status }),
    );
  const assetInfo = await api.finalizeImageUpload(taskId, {
    key: upload.key,
    filename,
    contentType,
    size,
    surface,
  });
  return { url: assetInfo.url, alt: filename.replace(/\.[^.]+$/, "") };
}

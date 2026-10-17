import { i18n } from "@/lib/i18n";
import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import { getImageAltText, isSupportedImageFile } from "@/lib/upload-task-image";

export async function uploadDraftAsset(projectId: string, file: File) {
  const json = {
    filename: file.name || "file",
    contentType: file.type || "application/octet-stream",
    size: file.size,
    surface: "description" as const,
  };
  const response = await client.task["draft-upload"][":projectId"].$post({
    param: { projectId },
    json,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  const upload = await response.json();
  const stored = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.headers,
    body: file,
  });
  if (!stored.ok)
    throw new Error(i18n.t("activity:comment.editor.failedToUploadFile"));
  const finalized = await client.task["draft-upload"][
    ":projectId"
  ].finalize.$post({
    param: { projectId },
    json: { ...json, key: upload.key },
  });
  if (!finalized.ok) throw await HttpError.fromResponse(finalized);
  const asset = await finalized.json();
  return {
    id: asset.id,
    url: asset.url,
    alt: getImageAltText(file.name),
    filename: json.filename,
    kind: isSupportedImageFile(file)
      ? ("image" as const)
      : ("attachment" as const),
    mimeType: json.contentType,
    size: file.size,
  };
}

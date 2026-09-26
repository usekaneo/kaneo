import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function createImageUpload({
  taskId,
  filename,
  contentType,
  size,
  surface,
}: {
  taskId: string;
  filename: string;
  contentType: string;
  size: number;
  surface: "description" | "comment";
}) {
  const response = await client.task["image-upload"][":id"].$put({
    param: { id: taskId },
    json: {
      filename,
      contentType,
      size,
      surface,
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export async function finalizeImageUpload({
  taskId,
  key,
  filename,
  contentType,
  size,
  surface,
}: {
  taskId: string;
  key: string;
  filename: string;
  contentType: string;
  size: number;
  surface: "description" | "comment";
}) {
  const response = await client.task["image-upload"][":id"].finalize.$post({
    param: { id: taskId },
    json: {
      key,
      filename,
      contentType,
      size,
      surface,
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default createImageUpload;

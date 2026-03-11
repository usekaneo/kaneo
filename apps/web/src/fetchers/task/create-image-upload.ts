import { client } from "@kaneo/libs";

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
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createImageUpload;

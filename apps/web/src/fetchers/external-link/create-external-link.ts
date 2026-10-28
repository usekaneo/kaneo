import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export type CreateExternalLinkRequest = {
  taskId: string;
  url: string;
  title?: string;
};

async function createExternalLink({
  taskId,
  url,
  title,
}: CreateExternalLinkRequest) {
  const response = await client["external-link"].task[":taskId"].$post({
    param: { taskId },
    json: {
      url,
      ...(title ? { title } : {}),
    },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default createExternalLink;

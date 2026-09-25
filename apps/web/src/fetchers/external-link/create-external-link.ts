import { client } from "@kaneo/libs";

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
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default createExternalLink;

import { client } from "@kaneo/libs";
import type {
  CreateExternalLinkRequest,
  UpdateExternalLinkRequest,
} from "../../types/external-links";

export async function getExternalLinks(taskId: string) {
  const response = await client["external-links"].task[":taskId"].$get({
    param: { taskId },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch external links");
  }

  return await response.json();
}

export async function createExternalLink(data: CreateExternalLinkRequest) {
  const response = await client["external-links"].$post({
    json: data,
  });

  if (!response.ok) {
    throw new Error("Failed to create external link");
  }

  return await response.json();
}

export async function updateExternalLink(
  linkId: string,
  data: UpdateExternalLinkRequest,
) {
  const response = await client["external-links"][":linkId"].$put({
    param: { linkId },
    json: data,
  });

  if (!response.ok) {
    throw new Error("Failed to update external link");
  }

  return await response.json();
}

export async function deleteExternalLink(linkId: string) {
  const response = await client["external-links"][":linkId"].$delete({
    param: { linkId },
  });

  if (!response.ok) {
    throw new Error("Failed to delete external link");
  }

  return await response.json();
}

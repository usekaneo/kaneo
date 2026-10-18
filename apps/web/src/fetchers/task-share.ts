import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

const taskShareEndpoint = client["task-share"][":taskId"];

export async function getTaskShare(taskId: string) {
  const response = await taskShareEndpoint.$get({ param: { taskId } });
  if (!response.ok)
    throw new HttpError(response.status, "Failed to load the share link");
  return response.json();
}

export async function ensureTaskShare(taskId: string) {
  const response = await taskShareEndpoint.$put({ param: { taskId } });
  if (!response.ok)
    throw new HttpError(response.status, "Failed to create the share link");
  return response.json();
}

export async function revokeTaskShare(taskId: string) {
  const response = await taskShareEndpoint.$delete({ param: { taskId } });
  if (!response.ok)
    throw new HttpError(response.status, "Failed to revoke the share link");
  return response.json();
}

export function getSharedTaskUrl(token: string) {
  return new URL(
    `/shared-task/${encodeURIComponent(token)}`,
    window.location.origin,
  ).toString();
}

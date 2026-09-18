import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type TaskAttachment = InferResponseType<
  (typeof client)["task-attachment"][":taskId"]["$get"],
  200
>[number];

async function unwrap<T>(response: {
  ok: boolean;
  text: () => Promise<string>;
  json: () => Promise<T>;
}) {
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      message = JSON.parse(text).message ?? text;
    } catch {}
    throw new Error(message);
  }
  return response.json();
}

export const taskAttachmentApi = {
  list: async (taskId: string) =>
    unwrap(
      await client["task-attachment"][":taskId"].$get({ param: { taskId } }),
    ),
  attachFile: async (taskId: string, fileId: string) =>
    unwrap(
      await client["task-attachment"][":taskId"].file.$post({
        param: { taskId },
        json: { fileId },
      }),
    ),
  attachLink: async (taskId: string, url: string, title?: string) =>
    unwrap(
      await client["task-attachment"][":taskId"].link.$post({
        param: { taskId },
        json: { url, ...(title ? { title } : {}) },
      }),
    ),
  remove: async (taskId: string, id: string) =>
    unwrap(
      await client["task-attachment"][":taskId"][":id"].$delete({
        param: { taskId, id },
      }),
    ),
};

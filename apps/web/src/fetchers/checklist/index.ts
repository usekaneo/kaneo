import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type TaskChecklist = InferResponseType<
  (typeof client)["checklist"][":taskId"]["$get"],
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

export const checklistApi = {
  list: async (taskId: string) =>
    unwrap(await client.checklist[":taskId"].$get({ param: { taskId } })),
  create: async (taskId: string, title?: string) =>
    unwrap(
      await client.checklist.$post({
        json: title ? { taskId, title } : { taskId },
      }),
    ),
  rename: async (taskId: string, id: string, title: string) =>
    unwrap(
      await client.checklist[":id"].$patch({
        param: { id },
        json: { taskId, title },
      }),
    ),
  remove: async (taskId: string, id: string) =>
    unwrap(
      await client.checklist[":id"].$delete({
        param: { id },
        json: { taskId },
      }),
    ),
  reorder: async (taskId: string, checklistIds: string[]) =>
    unwrap(
      await client.checklist.order.$put({ json: { taskId, checklistIds } }),
    ),
  setItems: async (taskId: string, id: string, relationIds: string[]) =>
    unwrap(
      await client.checklist[":id"].items.$put({
        param: { id },
        json: { taskId, relationIds },
      }),
    ),
};

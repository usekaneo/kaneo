import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type EmailLog = InferResponseType<
  (typeof client)["email-log"]["$get"],
  200
>;
export type EmailLogEntry = EmailLog["entries"][number];
export type EmailStatus = "queued" | "sending" | "sent" | "failed";

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

export const emailLogApi = {
  list: async (workspaceId: string, status?: EmailStatus) =>
    unwrap(
      await client["email-log"].$get({
        query: { workspaceId, ...(status ? { status } : {}) },
      }),
    ),
  retry: async (workspaceId: string, id: string) =>
    unwrap(
      await client["email-log"][":id"].retry.$post({
        param: { id },
        json: { workspaceId },
      }),
    ),
};

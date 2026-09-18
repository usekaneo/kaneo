import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type CompanyToday = InferResponseType<
  (typeof client)["overview"]["company"]["$get"],
  200
>;
export type AuditPage = InferResponseType<
  (typeof client)["overview"]["audit"]["$get"],
  200
>;

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

export const overviewApi = {
  company: async (workspaceId: string) =>
    unwrap(await client.overview.company.$get({ query: { workspaceId } })),
  audit: async (workspaceId: string, before?: string) =>
    unwrap(
      await client.overview.audit.$get({
        query: { workspaceId, ...(before ? { before } : {}) },
      }),
    ),
};

import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type ReportSummary = InferResponseType<
  (typeof client)["reports"]["summary"]["$get"],
  200
>;
export type ReportActivity = InferResponseType<
  (typeof client)["reports"]["activity"]["$get"],
  200
>;
export type ReportActivityItem = ReportActivity["items"][number];

export type ReportQuery = {
  workspaceId: string;
  from: string;
  to: string;
  projectId?: string;
  userId?: string;
};

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

// Hono's typed client rejects `undefined` values in queries.
const clean = (query: ReportQuery) =>
  Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined),
  ) as ReportQuery;

export const reportsApi = {
  summary: async (query: ReportQuery) =>
    unwrap(await client.reports.summary.$get({ query: clean(query) })),
  activity: async (query: ReportQuery & { before?: string }) =>
    unwrap(
      await client.reports.activity.$get({
        query: clean(query) as ReportQuery & { before?: string },
      }),
    ),
};

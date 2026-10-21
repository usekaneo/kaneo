import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

type Endpoint = typeof client.task.workspace.$get;
export type WorkspaceTaskQuery = Omit<
  InferRequestType<Endpoint>["query"],
  "page" | "workspaceId"
>;
export type WorkspaceTask = InferResponseType<Endpoint, 200>["tasks"][number];
export async function getWorkspaceTasks(
  workspaceId: string,
  filters: WorkspaceTaskQuery,
  page: number,
) {
  const response = await client.task.workspace.$get({
    query: { ...filters, workspaceId, page: String(page) },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

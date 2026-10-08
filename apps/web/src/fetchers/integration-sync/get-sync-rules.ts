import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { SyncParams } from "./types";

export default async function getSyncRules(param: SyncParams, after?: string) {
  const response = await client["integration-sync"].project[":projectId"][
    ":provider"
  ].$get({ param, query: after ? { after } : {} });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

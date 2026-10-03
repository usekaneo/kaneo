import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { SyncParams, SyncRules } from "./types";

export default async function saveSyncRules(
  param: SyncParams,
  rules: SyncRules,
  previewToken: string,
) {
  const response = await client["integration-sync"].project[":projectId"][
    ":provider"
  ].$patch({ param, json: { rules, previewToken } });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}

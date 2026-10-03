import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { SyncParams, SyncRules } from "./types";

export default async function previewSyncRules(
  param: SyncParams,
  rules: SyncRules,
) {
  const response = await client["integration-sync"].project[":projectId"][
    ":provider"
  ].preview.$post({ param, json: { rules } });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}

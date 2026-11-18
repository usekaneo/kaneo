import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { SyncParams, SyncRules } from "./types";

export default async function saveSyncRules(
  param: SyncParams,
  rules: SyncRules,
  previewToken: string,
) {
  const response = await client["integration-sync"].integration[
    ":integrationId"
  ].$patch({
    param: { integrationId: param.integrationId },
    json: { rules, previewToken },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

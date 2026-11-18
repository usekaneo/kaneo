import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { SyncParams } from "./types";

export default async function reviewSyncResume(
  param: SyncParams,
  linkId: string,
  signal?: AbortSignal,
) {
  const response = await client["integration-sync"].integration[
    ":integrationId"
  ].links[":linkId"].review.$get(
    {
      param: { integrationId: param.integrationId, linkId },
    },
    { init: { signal } },
  );
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

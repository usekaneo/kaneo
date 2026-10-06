import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { SyncParams } from "./types";

export default async function reviewSyncResume(
  param: SyncParams,
  linkId: string,
  signal?: AbortSignal,
) {
  const response = await client["integration-sync"].project[":projectId"][
    ":provider"
  ].links[":linkId"].review.$get(
    { param: { ...param, linkId } },
    { init: { signal } },
  );
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}

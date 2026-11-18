import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { SyncParams } from "./types";

export default async function resumeSync(
  param: SyncParams,
  linkId: string,
  token: string,
  source: "kaneo" | "provider",
) {
  const response = await client["integration-sync"].integration[
    ":integrationId"
  ].links[":linkId"].resume.$post({
    param: { integrationId: param.integrationId, linkId },
    json: { token, source },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import type { SyncParams } from "./types";

export default async function resumeSync(
  param: SyncParams,
  linkId: string,
  token: string,
  source: "kaneo" | "provider",
) {
  const response = await client["integration-sync"].project[":projectId"][
    ":provider"
  ].links[":linkId"].resume.$post({
    param: { ...param, linkId },
    json: { token, source },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}

import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono";
import { HttpError } from "@/lib/http-error";

export type GitHubAppInfo = InferResponseType<
  (typeof client)["github-integration"]["app-info"]["$get"],
  200
>;

export default async function getGitHubAppInfo(): Promise<GitHubAppInfo> {
  const response = await client["github-integration"]["app-info"].$get();

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const result = await response.json();
  return result;
}

import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono";

export type GitHubAppInfo = InferResponseType<
  (typeof client)["github-integration"]["app-info"]["$get"]
>;

export default async function getGitHubAppInfo(): Promise<GitHubAppInfo> {
  const response = await client["github-integration"]["app-info"].$get();

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const result = await response.json();
  return result;
}

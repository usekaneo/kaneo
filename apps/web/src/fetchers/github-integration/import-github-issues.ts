import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono";

export type ImportGithubIssuesRequest = InferRequestType<
  (typeof client)["github-integration"]["import-issues"]["$post"]
>["json"];

async function importGithubIssues(data: ImportGithubIssuesRequest) {
  const response = await client["github-integration"]["import-issues"].$post({
    json: data,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const result = await response.json();
  return result;
}

export default importGithubIssues;

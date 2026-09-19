import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono";
import { HttpError } from "@/lib/http-error";

export type ImportGithubIssuesRequest = InferRequestType<
  (typeof client)["github-integration"]["import-issues"]["$post"]
>["json"];

async function importGithubIssues(data: ImportGithubIssuesRequest) {
  const response = await client["github-integration"]["import-issues"].$post({
    json: data,
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const result = await response.json();
  return result;
}

export default importGithubIssues;

import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono";
import { HttpError } from "@/lib/http-error";

export type ImportGithubIssuesRequest = InferRequestType<
  (typeof client)["github-integration"]["import-issues"]["$post"]
>["json"];

async function importGithubIssues(data: ImportGithubIssuesRequest) {
  let runId = data.runId;
  let busyRetries = 0;
  for (;;) {
    const response = await client["github-integration"]["import-issues"].$post({
      json: { ...data, runId },
    });
    if (response.status === 429 && busyRetries < 5) {
      busyRetries++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }
    if (!response.ok)
      throw new HttpError(response.status, await response.text());
    const result = await response.json();
    if (response.status !== 202) return result;
    runId = result.runId;
    busyRetries = 0;
    // The server persists each page. A later call can resume even after the
    // browser closes; retries of a completed run do not start another import.
  }
}
export default importGithubIssues;

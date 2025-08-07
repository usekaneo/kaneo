import { client } from "@kaneo/libs";
import { useMutation } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono";

export type ImportGiteaIssuesRequest = InferRequestType<
  (typeof client)["gitea-integration"]["import-issues"]["$post"]
>["json"];

export type ImportGiteaIssuesResponse = InferResponseType<
  (typeof client)["gitea-integration"]["import-issues"]["$post"]
>;

async function importGiteaIssues(
  data: ImportGiteaIssuesRequest,
): Promise<ImportGiteaIssuesResponse> {
  const response = await client["gitea-integration"]["import-issues"].$post({
    json: data,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default function useImportGiteaIssues() {
  return useMutation({
    mutationFn: importGiteaIssues,
  });
}

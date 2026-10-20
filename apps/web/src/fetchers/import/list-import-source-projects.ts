import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";
import { HttpError } from "@/lib/http-error";

export type ListImportSourceProjectsRequest = InferRequestType<
  (typeof client)["import"]["projects"]["$post"]
>["json"];

export type ImportConnection = ListImportSourceProjectsRequest["connection"];

export type ListImportSourceProjectsResponse = InferResponseType<
  (typeof client)["import"]["projects"]["$post"],
  200
>;

export type ImportSourceProject =
  ListImportSourceProjectsResponse["projects"][number];

async function listImportSourceProjects(
  data: ListImportSourceProjectsRequest,
): Promise<ListImportSourceProjectsResponse> {
  const response = await client.import.projects.$post({ json: data });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default listImportSourceProjects;

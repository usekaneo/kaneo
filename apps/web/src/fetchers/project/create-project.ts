import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type CreateProjectRequest = InferRequestType<
  (typeof client)["project"]["$post"]
>["json"];

async function createProject(request: CreateProjectRequest) {
  const response = await client.project.$post({ json: request });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default createProject;

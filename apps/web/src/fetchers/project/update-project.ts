import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { HttpError } from "@/lib/http-error";

export type UpdateProjectRequest = InferRequestType<
  (typeof client)["project"][":id"]["$put"]
>["json"] &
  InferRequestType<(typeof client)["project"][":id"]["$put"]>["param"];

async function updateProject({
  id,
  name,
  icon,
  slug,
  description,
  isPublic,
  defaultSprintLengthDays,
}: UpdateProjectRequest) {
  const response = await client.project[":id"].$put({
    param: { id },
    json: {
      name,
      icon,
      slug,
      description,
      isPublic,
      // Optional so callers that only edit the form fields keep sending the
      // legacy payload and the API leaves the stored sprint length untouched.
      ...(defaultSprintLengthDays !== undefined
        ? { defaultSprintLengthDays }
        : {}),
    },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();

  return data;
}

export default updateProject;

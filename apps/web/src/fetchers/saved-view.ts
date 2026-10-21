import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";

const endpoint = client["saved-view"].projects[":projectId"];
export type PersonalView = InferResponseType<typeof endpoint.$get, 200>[number];
export type ProjectViewConfig = PersonalView["config"];
export async function getPersonalViews(projectId: string) {
  const response = await endpoint.$get({ param: { projectId } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
export async function savePersonalView(
  projectId: string,
  name: string,
  config: ProjectViewConfig,
  id?: string,
) {
  const response = id
    ? await endpoint[":id"].$put({
        param: { projectId, id },
        json: { name, config },
      })
    : await endpoint.$post({ param: { projectId }, json: { name, config } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
export async function deletePersonalView(projectId: string, id: string) {
  const response = await endpoint[":id"].$delete({ param: { projectId, id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

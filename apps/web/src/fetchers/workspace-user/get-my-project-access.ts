import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getMyProjectAccess(workspaceId: string) {
  const response = await client.workspace[":workspaceId"]["project-access"][
    "me"
  ].$get({ param: { workspaceId } });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getMyProjectAccess;

import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export default async function getQuillsWorkspaceContext(workspaceId: string) {
  const response = await client.quills[":workspaceId"].context.$get({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

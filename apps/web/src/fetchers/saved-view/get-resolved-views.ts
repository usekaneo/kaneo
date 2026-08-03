import { client } from "@kaneo/libs";
import type { ResolvedSavedView } from "@/types/saved-view";

async function getResolvedViews(
  workspaceId: string,
  projectId: string,
): Promise<ResolvedSavedView[]> {
  const response = await client["saved-view"].workspace[":workspaceId"].project[
    ":projectId"
  ].$get({
    param: { workspaceId, projectId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getResolvedViews;

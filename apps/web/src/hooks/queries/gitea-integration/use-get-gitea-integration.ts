import { client } from "@kaneo/libs";
import { useQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono";

export type GetGiteaIntegrationResponse = InferResponseType<
  (typeof client)["gitea-integration"]["project"][":projectId"]["$get"]
>;

async function getGiteaIntegration(
  projectId: string,
): Promise<GetGiteaIntegrationResponse | null> {
  const response = await client["gitea-integration"].project[":projectId"].$get(
    {
      param: { projectId },
    },
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default function useGetGiteaIntegration(projectId: string) {
  return useQuery({
    queryKey: ["gitea-integration", projectId],
    queryFn: () => getGiteaIntegration(projectId),
  });
}

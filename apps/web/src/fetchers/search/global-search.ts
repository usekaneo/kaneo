import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

type SearchParams = {
  q: string;
  type?:
    | "all"
    | "tasks"
    | "projects"
    | "workspaces"
    | "comments"
    | "activities";
  workspaceId: string;
  projectId?: string;
  limit?: number;
};

async function globalSearch(params: SearchParams) {
  const queryParams = {
    ...params,
    limit: params.limit?.toString(),
  };

  const response = await client.search.$get({
    query: queryParams,
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default globalSearch;

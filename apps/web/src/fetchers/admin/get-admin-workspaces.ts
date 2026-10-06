import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import {
  ADMIN_WORKSPACES_PAGE_SIZE,
  ADMIN_WORKSPACES_SEARCH_MAX_LENGTH,
} from "./workspace-types";

export async function getAdminWorkspaces(search: string, page: number) {
  const normalizedSearch = search
    .trim()
    .slice(0, ADMIN_WORKSPACES_SEARCH_MAX_LENGTH);
  const response = await client.admin.workspaces.$get({
    query: {
      ...(normalizedSearch ? { search: normalizedSearch } : {}),
      page: String(page + 1),
      limit: String(ADMIN_WORKSPACES_PAGE_SIZE),
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

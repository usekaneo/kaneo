import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import { ADMIN_USERS_PAGE_SIZE, ADMIN_USERS_SEARCH_MAX_LENGTH } from "./types";

export async function getAdminUsers(search: string, page: number) {
  const normalizedSearch = search
    .trim()
    .slice(0, ADMIN_USERS_SEARCH_MAX_LENGTH);
  const response = await client.admin.users.$get({
    query: {
      ...(normalizedSearch ? { search: normalizedSearch } : {}),
      page: String(page + 1),
      limit: String(ADMIN_USERS_PAGE_SIZE),
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

import { authClient } from "@/lib/auth-client";
import {
  ADMIN_USERS_PAGE_SIZE,
  type AdminUser,
  type AdminUsersResult,
} from "./types";

const SEARCH_BATCH_SIZE = 100;

async function listMatchingUsers(
  search: string,
  searchField: "email" | "name",
): Promise<AdminUser[]> {
  const users: AdminUser[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await authClient.admin.listUsers({
      query: {
        searchValue: search,
        searchField,
        searchOperator: "contains",
        limit: SEARCH_BATCH_SIZE,
        offset,
        sortBy: "createdAt",
        sortDirection: "desc",
      },
    });

    if (error) {
      throw new Error(error.message ?? "");
    }

    const batch = (data?.users ?? []) as AdminUser[];
    users.push(...batch);
    offset += batch.length;

    if (batch.length === 0 || offset >= (data?.total ?? offset)) {
      return users;
    }
  }
}

export async function getAdminUsers(
  search: string,
  page: number,
): Promise<AdminUsersResult> {
  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    const { data, error } = await authClient.admin.listUsers({
      query: {
        limit: ADMIN_USERS_PAGE_SIZE,
        offset: page * ADMIN_USERS_PAGE_SIZE,
        sortBy: "createdAt",
        sortDirection: "desc",
      },
    });

    if (error) {
      throw new Error(error.message ?? "");
    }

    return data as AdminUsersResult;
  }

  const results = await Promise.all(
    (["name", "email"] as const).map((searchField) =>
      listMatchingUsers(normalizedSearch, searchField),
    ),
  );
  const usersById = new Map<string, AdminUser>();

  for (const users of results) {
    for (const user of users) {
      usersById.set(user.id, user);
    }
  }

  const sortedUsers = [...usersById.values()].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  const start = page * ADMIN_USERS_PAGE_SIZE;

  return {
    users: sortedUsers.slice(start, start + ADMIN_USERS_PAGE_SIZE),
    total: sortedUsers.length,
  };
}

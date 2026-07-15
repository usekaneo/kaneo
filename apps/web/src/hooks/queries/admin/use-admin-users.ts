import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export const ADMIN_USERS_QUERY_KEY = ["admin", "users"] as const;
export const ADMIN_USERS_PAGE_SIZE = 20;

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  role?: string | null;
  banned: boolean | null;
  banReason?: string | null;
  banExpires?: Date | null;
};

type AdminUsersResult = {
  users: AdminUser[];
  total: number;
};

export async function fetchAdminUsers(
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
      throw new Error(error.message || "Failed to load users");
    }

    return data as AdminUsersResult;
  }

  const results = [];
  for (const searchField of ["name", "email"] as const) {
    results.push(
      await authClient.admin.listUsers({
        query: {
          searchValue: normalizedSearch,
          searchField,
          searchOperator: "contains",
          limit: 100,
          sortBy: "createdAt",
          sortDirection: "desc",
        },
      }),
    );
  }
  const error = results.find((result) => result.error)?.error;

  if (error) {
    throw new Error(error.message || "Failed to search users");
  }

  const users = new Map<string, AdminUser>();
  for (const result of results) {
    for (const user of (result.data?.users ?? []) as AdminUser[]) {
      users.set(user.id, user);
    }
  }

  const sortedUsers = [...users.values()].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  return {
    users: sortedUsers,
    total: sortedUsers.length,
  };
}

function useAdminUsers(search: string, page: number) {
  return useQuery({
    queryKey: [...ADMIN_USERS_QUERY_KEY, search, page],
    queryFn: () => fetchAdminUsers(search, page),
    placeholderData: (previousData) => previousData,
  });
}

export default useAdminUsers;

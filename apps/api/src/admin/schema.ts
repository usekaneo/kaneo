import { pagingNumber, z } from "../openapi";

export const listAdminUsersQuery = z.object({
  search: z.string().max(200).optional().openapi({
    description: "Case-insensitive match against user name or email.",
  }),
  page: pagingNumber(1, 1_000_000, 1),
  limit: pagingNumber(1, 100, 20),
});

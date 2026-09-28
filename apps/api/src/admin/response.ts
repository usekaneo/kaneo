import { z } from "../openapi";

const isoTimestamp = z.string().openapi({ format: "date-time" });

export const adminUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    role: z.string().nullable(),
    banned: z.boolean(),
    banReason: z.string().nullable(),
    banExpires: isoTimestamp.nullable(),
  })
  .openapi("AdminUser");

export const adminUserListSchema = z
  .object({
    users: z.array(adminUserSchema),
    total: z.number().int().openapi({
      description: "Number of users matching the search, across all pages.",
    }),
  })
  .openapi("AdminUserList");

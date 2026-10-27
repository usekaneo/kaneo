import { z } from "../../openapi";
import { adminAuditLogEntrySchema, adminUserSchema } from "../response";
import { serviceStatusSchema } from "../system/service-status";

export const overviewWarningSchema = z.enum([
  "smtp_not_configured",
  "smtp_unreachable",
  "redis_unreachable",
  "storage_incomplete",
  "storage_unreachable",
  "registration_without_email",
  "no_second_admin",
]);

export const adminOverviewSchema = z
  .object({
    users: z.object({
      total: z.number().int(),
      activeLast30Days: z.number().int().openapi({
        description:
          "Non-deactivated users with a session refreshed in the last 30 days, counted once per user. Expired bans do not deactivate an account. Revoked or removed sessions do not contribute.",
      }),
      deactivated: z.number().int(),
    }),
    workspaces: z.object({
      total: z.number().int(),
      archived: z.number().int(),
    }),
    recentUsers: z
      .array(
        adminUserSchema.pick({
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
        }),
      )
      .max(5),
    recentActions: z
      .array(
        adminAuditLogEntrySchema.pick({
          id: true,
          createdAt: true,
          action: true,
          actor: true,
          targetType: true,
          targetId: true,
          targetLabel: true,
        }),
      )
      .max(5),
    services: z.object({
      checkedAt: z.string().openapi({ format: "date-time" }),
      api: serviceStatusSchema,
      database: serviceStatusSchema,
      realtime: serviceStatusSchema,
      redis: serviceStatusSchema,
      email: serviceStatusSchema,
      storage: serviceStatusSchema,
    }),
    warnings: z.array(overviewWarningSchema),
  })
  .openapi("AdminOverview");

import type { AdminUser } from "@/hooks/queries/admin/use-admin-users";

export type PendingUserAction = {
  type: "deactivate" | "reactivate" | "delete";
  user: AdminUser;
};

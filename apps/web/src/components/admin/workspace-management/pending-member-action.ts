import type { AdminWorkspaceMember } from "@/fetchers/admin/workspace-types";

export type PendingMemberAction = {
  type: "transfer" | "remove";
  member: AdminWorkspaceMember;
};

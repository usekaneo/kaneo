import type { ProjectAccessMode } from "./project-access-mode";

export type MemberProjectAccess = {
  userId: string;
  projectAccess: ProjectAccessMode;
  projectIds: string[];
};

export type ProjectAccessMode = "all" | "selected";

export type ProjectAccessValue = {
  projectAccess: ProjectAccessMode;
  projectIds: string[];
};

export const ALL_PROJECTS_ACCESS: ProjectAccessValue = {
  projectAccess: "all",
  projectIds: [],
};

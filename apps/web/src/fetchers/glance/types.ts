export type GlanceTask = {
  taskId: string;
  title: string;
  status: string;
  priority: string | null;
  dueDate: string | null;
  number: number;
  projectId: string;
  projectName: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  columnName: string | null;
  assigneeId: string;
  assigneeName: string;
  assigneeImage: string | null;
  labels: Array<{ name: string; color: string }>;
};

export type GlanceFilters = {
  workspaces: Array<{ id: string; name: string; slug: string }>;
  projects: Array<{ id: string; name: string; workspaceId: string }>;
  labels: Array<{ name: string; color: string }>;
  priorities: string[];
};

export type GlanceMember = {
  id: string;
  name: string;
  image: string | null;
};

export type GlanceSavedView = {
  id: string;
  name: string;
  filters: Record<string, string>;
  groupBy: string;
};

export type GlancePrefs = {
  filters: Record<string, string>;
  groupBy: string;
  views: GlanceSavedView[];
};

export type GlanceFilterState = Pick<GlancePrefs, "filters" | "groupBy">;

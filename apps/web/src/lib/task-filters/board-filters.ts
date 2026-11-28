export type BoardFilters = {
  status: string[] | null;
  priority: string[] | null;
  assignee: string[] | null;
  dueDate: string[] | null;
  startDate?: string[] | null;
  labels: string[] | null;
  customFields: Record<string, string[]> | null;
  negated?: string[] | null;
};

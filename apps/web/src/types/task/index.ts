type TaskLabel = {
  id: string;
  name: string;
  color: string;
};

type TaskExternalLink = {
  id: string;
  taskId: string;
  integrationId: string;
  resourceType: string;
  externalId: string;
  url: string;
  title: string | null;
  metadata: Record<string, unknown> | null;
};

type TaskCustomFieldValue = {
  fieldId: string;
  value: string | null;
};

type Task = {
  id: string;
  title: string;
  number: number | null;
  description: string | null;
  descriptionDeferred?: boolean;
  status: string;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  progress: number;
  isMilestone: boolean;
  baselineStartDate: string | null;
  baselineDueDate: string | null;
  // Gantt scheduling constraint: "none" (default) | "start_no_earlier_than"
  // | "finish_no_later_than" | "must_start_on". Optional so existing test
  // fixtures/mocks built before this field existed keep compiling.
  constraintType?: string;
  constraintDate?: string | null;
  position: number | null;
  createdAt: string;
  updatedAt?: string;
  userId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeImage?: string | null;
  projectId: string;
  columnId?: string | null;
  labels?: TaskLabel[];
  externalLinks?: TaskExternalLink[];
  customFieldValues?: TaskCustomFieldValue[];
};

export default Task;

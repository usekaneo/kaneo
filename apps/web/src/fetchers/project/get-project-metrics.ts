import { client } from "@kaneo/libs";

export type ProjectMetrics = {
  projectId: string;
  projectName: string;
  summary: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    unassignedTasks: number;
    overdueTasks: number;
    completionPercentage: number;
  };
  columns: Array<{
    id: string | null;
    name: string;
    slug: string;
    color: string | null;
    position: number;
    isFinal: boolean;
    count: number;
  }>;
  assignees: Array<{
    userId: string | null;
    name: string;
    email: string | null;
    image: string | null;
    assigned: number;
    done: number;
    inProgress: number;
  }>;
  contracts: {
    total: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  priority: Array<{
    priority: string;
    count: number;
  }>;
  activity: Array<{
    date: string;
    created: number;
    completed: number;
  }>;
};

async function getProjectMetrics({
  id,
}: {
  id: string;
}): Promise<ProjectMetrics> {
  const response = await client.project[":id"].metrics.$get({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to load project metrics");
  }

  return response.json();
}

export default getProjectMetrics;

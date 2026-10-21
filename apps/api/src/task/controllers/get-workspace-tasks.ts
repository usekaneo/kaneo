import { getTaskAssignees } from "../assignees/get-task-assignees";
import getWorkspaceTaskPage, {
  type WorkspaceTaskFilters,
} from "./get-workspace-task-page";

export default async function getWorkspaceTasks(
  workspaceId: string,
  userId: string,
  filters: WorkspaceTaskFilters,
  page = 1,
) {
  const result = await getWorkspaceTaskPage(workspaceId, userId, filters, page);
  const assignees = await getTaskAssignees(result.tasks.map((task) => task.id));
  return {
    ...result,
    tasks: result.tasks.map((task) => ({
      ...task,
      assignees: assignees.get(task.id) ?? [],
    })),
  };
}

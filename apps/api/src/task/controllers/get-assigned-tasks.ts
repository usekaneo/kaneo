import getWorkspaceTaskPage from "./get-workspace-task-page";

export default async function getAssignedTasks(
  workspaceId: string,
  userId: string,
  countOnly = false,
  page = 1,
) {
  const result = await getWorkspaceTaskPage(
    workspaceId,
    userId,
    { assigneeId: userId, completion: "open" },
    page,
    countOnly,
  );
  return {
    ...result,
    tasks: result.tasks.map(({ completed: _completed, ...task }) => task),
  };
}

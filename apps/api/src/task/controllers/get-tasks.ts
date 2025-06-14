import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, taskTable, userTable } from "../../database/schema";

const DEFAULT_COLUMNS = [
  { id: "to-do", name: "To Do" },
  { id: "in-progress", name: "In Progress" },
  { id: "in-review", name: "In Review" },
  { id: "done", name: "Done" },
] as const;

async function getTasks(projectId: string) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  const tasks = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      description: taskTable.description,
      status: taskTable.status,
      priority: taskTable.priority,
      dueDate: taskTable.dueDate,
      position: taskTable.position,
      createdAt: taskTable.createdAt,
      userEmail: taskTable.userEmail,
      assigneeName: userTable.name,
      assigneeEmail: userTable.email,
      projectId: taskTable.projectId,
    })
    .from(taskTable)
    .leftJoin(userTable, eq(taskTable.userEmail, userTable.email))
    .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.projectId, projectId))
    .orderBy(taskTable.position);

  const columns = DEFAULT_COLUMNS.map((column) => ({
    id: column.id,
    name: column.name,
    tasks: tasks
      .filter((task) => task.status === column.id)
      .map((task) => ({
        ...task,
      })),
  }));

  const archivedTasks = tasks.filter((task) => task.status === "archived");
  const plannedTasks = tasks.filter((task) => task.status === "planned");

  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    icon: project.icon,
    description: project.description,
    isPublic: project.isPublic,
    workspaceId: project.workspaceId,
    columns,
    archivedTasks,
    plannedTasks,
  };
}

export default getTasks;

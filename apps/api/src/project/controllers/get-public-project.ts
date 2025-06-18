import { HTTPException } from "hono/http-exception";
import getTasks from "../../task/controllers/get-tasks";

export async function getPublicProject(id: string) {
  const project = await getTasks(id);

  if (!project) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  if (!project.isPublic) {
    throw new HTTPException(403, {
      message: "Project is not public",
    });
  }

  return project;
}

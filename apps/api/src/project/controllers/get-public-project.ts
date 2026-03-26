import { HTTPException } from "hono/http-exception";
import getTasks from "../../task/controllers/get-tasks";

export async function getPublicProject(id: string) {
  const result = await getTasks(id);

  if (!result.data) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  if (!result.data.isPublic) {
    throw new HTTPException(403, {
      message: "Project is not public",
    });
  }

  return result.data;
}

import getTasks from "../../task/controllers/get-tasks";

export async function getPublicProject(id: string) {
  const project = await getTasks(id);

  if (!project) {
    throw new Error("Project not found");
  }

  if (!project.isPublic) {
    throw new Error("Project is not public");
  }

  return project;
}

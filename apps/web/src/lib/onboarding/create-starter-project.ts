import createProject from "@/fetchers/project/create-project";
import importTasks, { type TaskToImport } from "@/fetchers/task/import-tasks";
import generateProjectSlug from "@/lib/generate-project-id";

const FALLBACK_SLUG = "PRJ";

export async function createStarterProject({
  workspaceId,
  name,
  tasks,
}: {
  workspaceId: string;
  name: string;
  tasks: TaskToImport[];
}) {
  const project = await createProject({
    name,
    slug: generateProjectSlug(name) || FALLBACK_SLUG,
    workspaceId,
    icon: "Layout",
  });
  await importTasks(project.id, tasks).catch(() => undefined);
  return project.id;
}

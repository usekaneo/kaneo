import db from "../../../database";
import { linkedTaskScope } from "./integration-task-scope";
import { findExternalLinksByTask, updateExternalLink } from "./link-manager";

// Provider requests may complete out of order across API instances. Every late
// completion repairs the provider using the current, still-linked task value.
export async function syncLatestTaskText(
  taskId: string,
  projectId: string,
  link: { id: string; integrationId: string | null },
  field: "title" | "description",
  initialValue: string,
  write: (value: string) => Promise<string | undefined>,
) {
  let value = initialValue;
  for (;;) {
    const updatedAt = await write(value);
    await updateExternalLink(link.id, {
      ...(field === "title" ? { title: value } : {}),
      outbound: { field, value, updatedAt },
    });
    const task = await db.query.taskTable.findFirst({
      where: linkedTaskScope(taskId, projectId),
      columns: { title: true, description: true },
    });
    if (!task) return;
    const current = field === "title" ? task.title : task.description || "";
    if (current === value) return;
    const stillLinked = (await findExternalLinksByTask(taskId)).some(
      (currentLink) =>
        currentLink.id === link.id &&
        currentLink.integrationId === link.integrationId &&
        currentLink.resourceType === "issue",
    );
    if (!stillLinked) return;
    value = current;
  }
}

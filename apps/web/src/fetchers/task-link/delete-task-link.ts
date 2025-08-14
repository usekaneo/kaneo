import { client } from "@kaneo/libs";

async function deleteTaskLink(taskId: string, linkId: string) {
  // biome-ignore lint/suspicious/noExplicitAny: task-link route not typed
  const response = await (client as any)["task-link"][":taskId"][
    ":linkId"
  ].$delete({
    param: { taskId, linkId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default deleteTaskLink;

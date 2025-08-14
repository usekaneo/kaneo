import { client } from "@kaneo/libs";

async function getTaskLinks(taskId: string) {
  // biome-ignore lint/suspicious/noExplicitAny: task-link route not typed
  const response = await (client as any)["task-link"][":taskId"].$get({
    param: { taskId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default getTaskLinks;

import { client } from "@kaneo/libs";

async function getCustomFieldValuesByTask({ taskId }: { taskId: string }) {
  const response = await client["custom-field"].task[":taskId"].$get({
    param: { taskId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getCustomFieldValuesByTask;

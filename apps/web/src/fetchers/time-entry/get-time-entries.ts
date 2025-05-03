import { client } from "@kaneo/libs";

async function getTimeEntriesByTaskId(taskId: string) {
  const response = await client["time-entry"].task[":taskId"].$get({
    param: { taskId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}

export default getTimeEntriesByTaskId;

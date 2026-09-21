import { client } from "@kaneo/libs";

async function stopTimeEntry(taskId: string) {
  const response = await client["time-entry"].task[":taskId"].stop.$post({
    param: { taskId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}

export default stopTimeEntry;

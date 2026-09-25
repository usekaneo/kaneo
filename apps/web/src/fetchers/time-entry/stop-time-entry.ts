import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function stopTimeEntry(taskId: string) {
  const response = await client["time-entry"].task[":taskId"].stop.$post({
    param: { taskId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data;
}

export default stopTimeEntry;

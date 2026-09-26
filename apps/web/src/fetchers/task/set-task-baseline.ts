import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function setTaskBaseline(taskId: string) {
  const response = await client.task[":id"].baseline.$post({
    param: { id: taskId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default setTaskBaseline;

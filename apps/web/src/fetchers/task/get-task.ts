import { api } from "@kaneo/libs";

async function getTask(taskId: string) {
  const response = await api.task({ taskId }).get();

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response.data;
}

export default getTask;

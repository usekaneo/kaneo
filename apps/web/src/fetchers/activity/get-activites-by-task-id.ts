import { api } from "@kaneo/libs";

async function getActivitesByTaskId(taskId: string) {
  const response = await api.activity.list({ taskId }).get();

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response.data;
}

export default getActivitesByTaskId;

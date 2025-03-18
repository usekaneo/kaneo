import { api } from "@kaneo/libs";

async function getTasks(projectId: string) {
  const response = await api.task.list({ projectId }).get();

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response.data;
}

export default getTasks;

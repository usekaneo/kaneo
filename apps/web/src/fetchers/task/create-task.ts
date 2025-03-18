import { api } from "@kaneo/libs";

async function createTask(
  title: string,
  description: string,
  projectId: string,
  userEmail: string,
  status: string,
  dueDate: Date,
  priority: string,
  position: number,
) {
  const response = await api.task.create.post({
    title,
    description,
    projectId,
    userEmail,
    status,
    dueDate,
    priority,
    position,
  });

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response?.data;
}

export default createTask;

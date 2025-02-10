import { api } from '@kaneo/libs';

async function createProject(
  title: string,
  description: string,
  projectId: string,
  userEmail: string,
  status: string,
  dueDate: Date,
  priority: string,
) {
  const response = await api.task.create.post({
    title,
    description,
    projectId,
    userEmail,
    status,
    dueDate,
    priority,
  });

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response?.data;
}

export default createProject;

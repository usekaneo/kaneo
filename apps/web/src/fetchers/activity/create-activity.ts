import { api } from "@kaneo/libs";

async function createActivity(data: {
  taskId: string;
  content: string;
  userEmail: string;
}) {
  const response = await api.activity.comment.post({
    taskId: data.taskId,
    content: data.content,
    userEmail: data.userEmail,
  });

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response.data;
}

export default createActivity;

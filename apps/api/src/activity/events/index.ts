import { subscribeToEvent } from "../../events";
import createActivity from "../controllers/create-activity";

subscribeToEvent(
  "task.created",
  async (data: {
    taskId: string;
    userEmail: string;
    type: string;
    content: string;
  }) => {
    if (!data.userEmail) {
      return;
    }

    await createActivity({
      taskId: data.taskId,
      userEmail: data.userEmail,
      type: data.type,
      content: data.content,
    });
  },
);

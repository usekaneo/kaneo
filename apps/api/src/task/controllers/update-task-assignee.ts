import { changeTaskAssignees } from "../assignees/change-task-assignees";

export default function updateTaskAssignee({
  id,
  userId,
  currentUserId,
}: {
  id: string;
  userId: string | null;
  currentUserId: string;
}) {
  return changeTaskAssignees({
    id,
    userIds: userId?.trim() ? [userId.trim()] : [],
    mode: "set",
    currentUserId,
  });
}

import { MarkdownRenderer } from "@/components/common/markdown-renderer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import useDeleteComment from "@/hooks/mutations/comment/use-delete-comment";
import useGetActivitiesByTaskId from "@/hooks/queries/activity/use-get-activities-by-task-id";
import { cn } from "@/lib/cn";
import { Route } from "@/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId_";
import { formatDistanceToNow } from "date-fns";
import { History, MessageSquare, Pencil, PlusCircle } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../providers/auth-provider/hooks/use-auth";
import TaskComment from "./task-comment";

function TaskActivities() {
  const { taskId } = Route.useParams();
  const { user } = useAuth();
  const { data: activities } = useGetActivitiesByTaskId(taskId);
  const { mutateAsync: deleteComment } = useDeleteComment(taskId);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);

  const handleDeleteComment = (activityId: string) => {
    if (user?.id) {
      deleteComment({
        id: activityId,
        userId: user.id,
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {activities?.map((activity) => (
        <div key={activity.id} className="flex items-start gap-4">
          <div className="relative">
            <Avatar className="w-8 h-8">
              <AvatarFallback>
                {activity.userId?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div
              className={cn(
                "absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center",
                activity.type === "create" &&
                  "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400",
                activity.type === "update" &&
                  "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
                activity.type === "status" &&
                  "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
                activity.type === "comment" &&
                  "bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400",
              )}
            >
              {activity.type === "create" && <PlusCircle className="w-3 h-3" />}
              {activity.type === "update" && <Pencil className="w-3 h-3" />}
              {activity.type === "status" && <History className="w-3 h-3" />}
              {activity.type === "comment" && (
                <MessageSquare className="w-3 h-3" />
              )}
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-400">
                {activity.userId}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatDistanceToNow(activity.createdAt)} ago
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-sm text-zinc-600 dark:text-zinc-100">
                {activity.type === "create" && activity.content}
                {activity.type === "update" && activity.content}
                {activity.type === "status" && activity.content}
                {activity.type === "comment" &&
                  (editingCommentId === activity.id ? (
                    <TaskComment
                      initialComment={activity.content || ""}
                      commentId={activity.id || null}
                      onSubmit={() => setEditingCommentId(null)}
                    />
                  ) : (
                    <div className="text-zinc-600 dark:text-zinc-100">
                      <MarkdownRenderer content={activity.content || ""} />
                    </div>
                  ))}
              </div>
              {activity.type === "comment" && editingCommentId === null && (
                <div className="flex flex-row gap-3">
                  <button
                    type="button"
                    className="text-xs underline text-zinc-500 dark:text-zinc-400"
                    onClick={() => setEditingCommentId(activity.id ?? null)}
                  >
                    Edit
                  </button>
                  <button
                    className="text-xs underline text-zinc-500 dark:text-zinc-400"
                    tabIndex={0}
                    type="button"
                    onClick={() => handleDeleteComment(activity.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        handleDeleteComment(activity.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
              {activity.type === "comment" &&
                editingCommentId === activity.id && (
                  <div className="flex flex-row gap-3">
                    <button
                      type="button"
                      className="text-xs underline text-zinc-500 dark:text-zinc-400"
                      onClick={() => setEditingCommentId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default TaskActivities;

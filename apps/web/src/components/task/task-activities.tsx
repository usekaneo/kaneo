import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import useGetActivitiesByTaskId from "@/hooks/queries/activity/use-get-activities-by-task-id";
import { cn } from "@/lib/cn";
import { Route } from "@/routes/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId";
import { formatDistanceToNow } from "date-fns";
import { History, MessageSquare, Pencil, PlusCircle } from "lucide-react";

function TaskActivities() {
  const { taskId } = Route.useParams();
  const { data: activities } = useGetActivitiesByTaskId(taskId);

  return (
    <div className="space-y-3">
      {activities?.map((activity) => (
        <div key={activity.id} className="flex items-start gap-3">
          <div className="relative">
            <Avatar className="w-8 h-8">
              <AvatarFallback>{activity.userEmail.charAt(0)}</AvatarFallback>
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
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {activity.userEmail}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {formatDistanceToNow(activity.createdAt)} ago
              </span>
            </div>
            <div className="mt-1.5">
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {activity.type === "create" && activity.content}
                {activity.type === "update" && activity.content}
                {activity.type === "status" && activity.content}
                {activity.type === "comment" && activity.content}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default TaskActivities;

import { MarkdownRenderer } from "@/components/common/markdown-renderer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { priorityColorsTaskCard } from "@/constants/priority-colors";
import { cn } from "@/lib/cn";
import type Task from "@/types/task";
import * as Dialog from "@radix-ui/react-dialog";
import { format } from "date-fns";
import { Calendar, Flag, User, X } from "lucide-react";

interface PublicTaskDetailModalProps {
  task: Task | null;
  projectSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PublicTaskDetailModal({
  task,
  projectSlug,
  open,
  onOpenChange,
}: PublicTaskDetailModalProps) {
  if (!task) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-hidden">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700/50 flex flex-col h-full max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="text-sm text-zinc-600 dark:text-zinc-400 font-mono font-medium">
                  {projectSlug.toUpperCase()}-{task.number}
                </div>
                <div className="w-1 h-1 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full" />
                <div className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                  Task Details
                </div>
              </div>
              <Dialog.Close className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded-lg transition-all duration-200">
                <X size={18} />
              </Dialog.Close>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Title */}
                <div>
                  <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 leading-relaxed">
                    {task.title}
                  </h1>
                </div>

                {/* Meta information */}
                <div className="flex flex-wrap items-center gap-4">
                  {task.priority && (
                    <div
                      className={cn(
                        "flex items-center gap-2 text-sm px-3 py-1.5 rounded-full font-medium",
                        priorityColorsTaskCard[
                          task.priority as keyof typeof priorityColorsTaskCard
                        ],
                      )}
                    >
                      <Flag className="w-4 h-4" />
                      <span className="capitalize">
                        {task.priority} Priority
                      </span>
                    </div>
                  )}

                  {task.userEmail && (
                    <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 px-3 py-1.5 rounded-full">
                      <User className="w-4 h-4" />
                      <span>Assigned to</span>
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-xs font-medium">
                          {task.userEmail.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{task.userEmail}</span>
                    </div>
                  )}

                  {task.dueDate && (
                    <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 px-3 py-1.5 rounded-full">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Due {format(new Date(task.dueDate), "MMM d, yyyy")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {task.description && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                      Description
                    </h3>
                    <MarkdownRenderer content={task.description} />
                  </div>
                )}

                {/* Task Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                      Created
                    </div>
                    <div className="text-sm text-zinc-900 dark:text-zinc-100">
                      {format(new Date(task.createdAt), "MMM d, yyyy")}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                      Last Updated
                    </div>
                    <div className="text-sm text-zinc-900 dark:text-zinc-100">
                      {format(new Date(task.createdAt), "MMM d, yyyy")}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800/50 p-4 flex-shrink-0">
              <div className="text-center text-xs text-zinc-500 dark:text-zinc-400">
                This is a read-only view of the task
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

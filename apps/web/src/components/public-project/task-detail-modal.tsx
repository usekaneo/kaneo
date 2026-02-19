import { format } from "date-fns";
import {
  Calendar,
  CalendarClock,
  CalendarX,
  ExternalLink as ExternalLinkIcon,
  GitBranch,
  GitMerge,
  GitPullRequest,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogClose, DialogPopup } from "@/components/ui/dialog";
import { dueDateStatusColors, getDueDateStatus } from "@/lib/due-date-status";
import { getPriorityIcon } from "@/lib/priority";
import type { ExternalLink } from "@/types/external-link";
import type Task from "@/types/task";
import { MarkdownRenderer } from "./markdown-renderer";
import { PublicTaskLabels } from "./public-task-labels";

type PublicTaskDetailModalProps = {
  task:
    | (Task & {
        labels?: Array<{ id: string; name: string; color: string }>;
        externalLinks?: Array<ExternalLink>;
      })
    | null;
  projectSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PublicTaskDetailModal({
  task,
  projectSlug,
  open,
  onOpenChange,
}: PublicTaskDetailModalProps) {
  if (!task) return null;

  const labels = task.labels || [];
  const externalLinks = task.externalLinks || [];

  const pullRequests = externalLinks.filter(
    (link) => link.resourceType === "pull_request",
  );
  const issues = externalLinks.filter((link) => link.resourceType === "issue");
  const branches = externalLinks.filter(
    (link) => link.resourceType === "branch",
  );

  const getPRStatus = (pr: (typeof pullRequests)[number]) => {
    if (pr.metadata?.merged) {
      return {
        icon: <GitMerge className="w-3.5 h-3.5" />,
        label: "Merged",
        className: "text-info-foreground",
      };
    }
    if (pr.metadata?.draft) {
      return {
        icon: <GitPullRequest className="w-3.5 h-3.5" />,
        label: "Draft",
        className: "text-muted-foreground",
      };
    }
    return {
      icon: <GitPullRequest className="w-3.5 h-3.5" />,
      label: "Open",
      className: "text-success-foreground",
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="w-full max-w-3xl max-h-[85vh]">
        <div className="bg-background border border-border rounded-lg flex flex-col max-h-[85vh] shadow-lg">
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-xs font-mono text-muted-foreground shrink-0">
                {projectSlug.toUpperCase()}-{task.number}
              </span>
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded capitalize shrink-0">
                {task.status?.replace("-", " ")}
              </span>
            </div>
            <DialogClose
              className="shrink-0 p-1.5 hover:bg-muted rounded transition-colors"
              render={<button type="button" />}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </DialogClose>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground pr-8">
                {task.title}
              </h2>

              <div className="flex flex-wrap gap-2">
                {task.priority && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-muted text-muted-foreground rounded-md">
                    {getPriorityIcon(task.priority)}
                    <span className="capitalize">{task.priority}</span>
                  </div>
                )}

                {task.dueDate && (
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
                  >
                    {getDueDateStatus(task.dueDate) === "overdue" && (
                      <CalendarX className="w-3 h-3" />
                    )}
                    {getDueDateStatus(task.dueDate) === "due-soon" && (
                      <CalendarClock className="w-3 h-3" />
                    )}
                    {(getDueDateStatus(task.dueDate) === "far-future" ||
                      getDueDateStatus(task.dueDate) === "no-due-date") && (
                      <Calendar className="w-3 h-3" />
                    )}
                    <span>Due {format(new Date(task.dueDate), "MMM d")}</span>
                  </div>
                )}

                {task.assigneeName && (
                  <div className="flex items-center gap-2 px-2.5 py-1 text-xs bg-muted text-muted-foreground rounded-md">
                    <Avatar className="h-4 w-4">
                      <AvatarImage
                        src={task.assigneeImage ?? ""}
                        alt={task.assigneeName ?? ""}
                      />
                      <AvatarFallback className="text-[10px]">
                        {task.assigneeName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{task.assigneeName}</span>
                  </div>
                )}
              </div>
            </div>

            {labels.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Labels
                </h3>
                <PublicTaskLabels labels={labels} />
              </div>
            )}

            {task.description && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Description
                </h3>
                <div className="text-sm text-foreground leading-relaxed bg-muted/30 p-4 rounded-md border border-border/50">
                  <MarkdownRenderer content={task.description} />
                </div>
              </div>
            )}

            {externalLinks.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  External Links
                </h3>

                {pullRequests.length > 0 && (
                  <div className="space-y-2">
                    {pullRequests.map((pr) => {
                      const status = getPRStatus(pr);
                      const repoMatch = pr.url.match(
                        /github\.com\/([^/]+\/[^/]+)\/pull/,
                      );
                      const repoName = repoMatch ? repoMatch[1] : null;
                      return (
                        <a
                          key={pr.id}
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-md border border-border/50 transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                              <span className="text-sm font-medium text-foreground truncate">
                                {pr.title || "Pull Request"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {repoName}#{pr.externalId}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-xs font-medium flex items-center gap-1 ${status.className}`}
                            >
                              {status.icon}
                              {status.label}
                            </span>
                            <ExternalLinkIcon className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}

                {issues.length > 0 && (
                  <div className="space-y-2">
                    {issues.map((issue) => (
                      <a
                        key={issue.id}
                        href={issue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-md border border-border/50 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <GitPullRequest className="w-3.5 h-3.5 text-muted-foreground" />
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <span className="text-sm font-medium text-foreground truncate">
                              {issue.title || "Issue"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              #{issue.externalId}
                            </span>
                          </div>
                        </div>
                        <ExternalLinkIcon className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ))}
                  </div>
                )}

                {branches.length > 0 && (
                  <div className="space-y-2">
                    {branches.map((branch) => (
                      <a
                        key={branch.id}
                        href={branch.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted rounded-md border border-border/50 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground truncate">
                            {branch.title || branch.externalId}
                          </span>
                        </div>
                        <ExternalLinkIcon className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  Created
                </div>
                <div className="text-sm text-foreground">
                  {format(new Date(task.createdAt), "MMM d, yyyy")}
                </div>
              </div>
              {task.dueDate && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Due Date
                  </div>
                  <div className="text-sm text-foreground">
                    {format(new Date(task.dueDate), "MMM d, yyyy")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}

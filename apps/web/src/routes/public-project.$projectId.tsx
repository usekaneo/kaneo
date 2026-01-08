import { createFileRoute } from "@tanstack/react-router";
import { Layout, List } from "lucide-react";
import { createElement, useEffect, useState } from "react";
import PageTitle from "@/components/page-title";
import { CopyUrlButton } from "@/components/public-project/copy-url-button";
import { ErrorView } from "@/components/public-project/error-view";
import { PublicKanbanView } from "@/components/public-project/kanban-view";
import { KaneoBranding } from "@/components/public-project/kaneo-branding";
import { PublicListView } from "@/components/public-project/list-view";
import { LoadingSkeleton } from "@/components/public-project/loading-skeleton";
import { PublicTaskDetailModal } from "@/components/public-project/task-detail-modal";
import { ThemeToggle } from "@/components/public-project/theme-toggle";
import { Button } from "@/components/ui/button";
import icons from "@/constants/project-icons";
import useGetPublicProject from "@/hooks/queries/project/use-get-public-project";
import type Task from "@/types/task";

export const Route = createFileRoute("/public-project/$projectId")({
  component: RouteComponent,
});

type ViewMode = "kanban" | "list";

const VIEW_MODE_STORAGE_KEY = "kaneo-public-view-mode";

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { data: project, isLoading, error } = useGetPublicProject(projectId);

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      return (saved as ViewMode) || "kanban";
    }
    return "kanban";
  });

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleTaskModalClose = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(null);
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !project) {
    return <ErrorView />;
  }

  return (
    <>
      <PageTitle title="Public View" />
      <div className="min-h-screen bg-background flex flex-col w-full">
        <header className="border-b border-border sticky top-0 z-10 bg-background">
          <div className="px-6 py-2.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {createElement(
                    icons[project.icon as keyof typeof icons] || Layout,
                    {
                      className: "w-5 h-5 text-muted-foreground",
                    },
                  )}
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold text-foreground truncate">
                      {project.name}
                    </h1>
                    <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded font-medium shrink-0">
                      Public
                    </span>
                  </div>
                  {project.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {project.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <CopyUrlButton />
                <ThemeToggle />
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("kanban")}
                    className={`h-8 gap-2 ${viewMode === "kanban" ? "bg-accent" : ""}`}
                  >
                    <Layout className="h-3 w-3" />
                    <span className="text-xs">Board</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className={`h-8 gap-2 ${viewMode === "list" ? "bg-accent" : ""}`}
                  >
                    <List className="h-3 w-3" />
                    <span className="text-xs">List</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 flex flex-col">
          {viewMode === "kanban" ? (
            <PublicKanbanView project={project} onTaskClick={handleTaskClick} />
          ) : (
            <PublicListView project={project} onTaskClick={handleTaskClick} />
          )}
        </main>

        <footer className="border-t border-border">
          <div className="px-6 py-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <KaneoBranding />
              <span>Read-only</span>
            </div>
          </div>
        </footer>

        <PublicTaskDetailModal
          task={selectedTask}
          projectSlug={project.slug}
          open={isTaskModalOpen}
          onOpenChange={handleTaskModalClose}
        />
      </div>
    </>
  );
}

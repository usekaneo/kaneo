import { CopyUrlButton } from "@/components/public-project/copy-url-button";
import { ErrorView } from "@/components/public-project/error-view";
import { PublicKanbanView } from "@/components/public-project/kanban-view";
import { KaneoBranding } from "@/components/public-project/kaneo-branding";
import { PublicListView } from "@/components/public-project/list-view";
import { LoadingSkeleton } from "@/components/public-project/loading-skeleton";
import { ThemeToggle } from "@/components/public-project/theme-toggle";
import { Button } from "@/components/ui/button";
import icons from "@/constants/project-icons";
import useGetPublicProject from "@/hooks/queries/project/use-get-public-project";
import { createFileRoute } from "@tanstack/react-router";
import { Grid3X3, Layout, List } from "lucide-react";
import { createElement, useState } from "react";

export const Route = createFileRoute("/public-project/$projectId")({
  component: RouteComponent,
});

type ViewMode = "kanban" | "list";

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { data: project, isLoading, error } = useGetPublicProject(projectId);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !project) {
    return <ErrorView />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col w-full">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 backdrop-blur-sm bg-white/95 dark:bg-zinc-900/95">
        <div className="px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                  {createElement(
                    icons[project.icon as keyof typeof icons] || Layout,
                    {
                      className: "w-6 h-6 shrink-0",
                    },
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                    {project.name}
                  </h1>
                  <span className="px-3 py-1 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium border border-green-200 dark:border-green-800">
                    Public View
                  </span>
                </div>
              </div>
              {project.description && (
                <p className="text-zinc-600 dark:text-zinc-400 max-w-3xl leading-relaxed">
                  {project.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 lg:flex-shrink-0">
              <CopyUrlButton />
              <ThemeToggle />
              <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700" />
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "kanban" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("kanban")}
                  className="gap-2"
                >
                  <Grid3X3 className="w-4 h-4" />
                  Board
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="gap-2"
                >
                  <List className="w-4 h-4" />
                  List
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 min-h-0 flex flex-col">
        {viewMode === "kanban" ? (
          <PublicKanbanView project={project} />
        ) : (
          <PublicListView project={project} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 py-4">
        <div className="px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <KaneoBranding />
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center md:text-right">
              This is a read-only public view of the project.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { priorityColorsTaskCard } from "@/constants/priority-colors";
import useGetPublicProject from "@/hooks/queries/project/use-get-public-project";
import { cn } from "@/lib/cn";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  ExternalLink,
  Flag,
  Grid3X3,
  Layout,
  List,
  Moon,
  Star,
  Sun,
  icons,
} from "lucide-react";
import { createElement, useEffect, useState } from "react";

export const Route = createFileRoute("/public-project/$projectId")({
  component: RouteComponent,
});

type ViewMode = "kanban" | "list";

const DEFAULT_COLUMNS = [
  { id: "to-do", name: "To Do", icon: Circle },
  { id: "in-progress", name: "In Progress", icon: Clock },
  { id: "in-review", name: "In Review", icon: AlertCircle },
  { id: "done", name: "Done", icon: CheckCircle2 },
] as const;

function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const shouldBeDark =
      savedTheme === "dark" || (!savedTheme && systemPrefersDark);

    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle("dark", shouldBeDark);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem("theme", newTheme ? "dark" : "light");
    document.documentElement.classList.toggle("dark", newTheme);
  };

  return (
    <Button variant="outline" size="sm" onClick={toggleTheme} className="gap-2">
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      {isDark ? "Light" : "Dark"}
    </Button>
  );
}

function CopyUrlButton() {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy URL:", error);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopyUrl}
      className="gap-2"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          Copy URL
        </>
      )}
    </Button>
  );
}

function KaneoBranding() {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
      <span>Powered by</span>
      <div className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
        <Star className="w-4 h-4" />
        <span>Kaneo</span>
      </div>
      <ArrowRight className="w-3 h-3" />
      <span className="text-xs">Project Management Made Simple</span>
    </div>
  );
}

function PublicTaskCard({
  task,
  projectSlug,
}: { task: Task; projectSlug: string }) {
  return (
    <div className="p-4 bg-white dark:bg-zinc-800/80 rounded-lg border border-zinc-200 dark:border-zinc-700/50 shadow-sm hover:shadow-md transition-shadow">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              {projectSlug}-{task.number}
            </div>
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-relaxed">
              {task.title}
            </h3>
          </div>
        </div>

        {task.description && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed">
            {task.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {task.priority && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium",
                  priorityColorsTaskCard[
                    task.priority as keyof typeof priorityColorsTaskCard
                  ],
                )}
              >
                <Flag className="w-3 h-3" />
                <span className="capitalize">{task.priority}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {task.userEmail && (
              <Avatar className="h-6 w-6 ring-2 ring-zinc-100 dark:ring-zinc-700">
                <AvatarFallback className="text-xs font-medium">
                  {task.userEmail.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            {task.dueDate && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                {format(new Date(task.dueDate), "MMM d")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PublicTaskRow({
  task,
  projectSlug,
}: { task: Task; projectSlug: string }) {
  return (
    <div className="group px-4 py-3 rounded-lg flex items-center gap-4 bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 shadow-sm hover:shadow-md transition-all hover:border-zinc-300 dark:hover:border-zinc-600">
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400 shrink-0 font-medium">
          {projectSlug}-{task.number}
        </div>
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {task.title}
        </h3>
      </div>

      <div className="flex items-center gap-3">
        {task.userEmail && (
          <Avatar className="h-6 w-6 ring-2 ring-zinc-100 dark:ring-zinc-700">
            <AvatarFallback className="text-xs font-medium">
              {task.userEmail.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}

        {task.dueDate && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            {format(new Date(task.dueDate), "MMM d")}
          </div>
        )}

        {task.priority && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium",
              priorityColorsTaskCard[
                task.priority as keyof typeof priorityColorsTaskCard
              ],
            )}
          >
            <Flag className="w-3 h-3" />
            <span className="capitalize">{task.priority}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PublicKanbanView({ project }: { project: ProjectWithTasks }) {
  const columns = DEFAULT_COLUMNS.map((column) => ({
    ...column,
    tasks: project.columns?.find((col) => col.id === column.id)?.tasks || [],
  }));

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <div className="h-full overflow-x-auto overflow-y-hidden">
        <div className="flex gap-6 p-6 h-full min-w-max">
          {columns.map((column) => {
            const IconComponent = column.icon;
            return (
              <div
                key={column.id}
                className="w-80 flex flex-col bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-700/50 overflow-hidden flex-1"
              >
                <div className="px-4 py-3 bg-white dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700/50">
                  <div className="flex items-center gap-2">
                    <IconComponent className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {column.name}
                    </h3>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full font-medium">
                      {column.tasks.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-0">
                  {column.tasks.map((task) => (
                    <PublicTaskCard
                      key={task.id}
                      task={task}
                      projectSlug={project.slug}
                    />
                  ))}

                  {column.tasks.length === 0 && (
                    <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-12 px-4">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-2">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      No tasks in {column.name.toLowerCase()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PublicListView({ project }: { project: ProjectWithTasks }) {
  const columns = DEFAULT_COLUMNS.map((column) => ({
    ...column,
    tasks: project.columns?.find((col) => col.id === column.id)?.tasks || [],
  }));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-6 space-y-8 max-w-5xl mx-auto">
        {columns.map((column) => {
          const IconComponent = column.icon;
          return (
            <div key={column.id} className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <IconComponent className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
                  {column.name}
                </h3>
                <span className="text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-3 py-1 rounded-full font-medium">
                  {column.tasks.length}
                </span>
              </div>

              <div className="space-y-3">
                {column.tasks.map((task) => (
                  <PublicTaskRow
                    key={task.id}
                    task={task}
                    projectSlug={project.slug}
                  />
                ))}

                {column.tasks.length === 0 && (
                  <div className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-8 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-2">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    No tasks in {column.name.toLowerCase()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { data: project, isLoading, error } = useGetPublicProject(projectId);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col w-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse space-y-8 max-w-6xl mx-auto">
              <div className="text-center space-y-4">
                <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-md w-64 mx-auto" />
                <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md w-96 mx-auto" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {["skeleton-1", "skeleton-2", "skeleton-3", "skeleton-4"].map(
                  (skeletonId) => (
                    <div key={skeletonId} className="space-y-3">
                      <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                      <div className="space-y-2">
                        {["task-1", "task-2", "task-3"].map((taskId) => (
                          <div
                            key={`${skeletonId}-${taskId}`}
                            className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg"
                          />
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col w-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
              <ExternalLink className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                Project Not Found
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
                This project doesn't exist or is not publicly accessible.
              </p>
            </div>
            <KaneoBranding />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col w-full">
      {/* Header */}
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

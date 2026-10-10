import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CalendarRange,
  Check,
  ChevronsUpDown,
  Plus,
  SquareKanban,
  SquircleDashed,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import icons from "@/constants/project-icons";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { cn } from "@/lib/cn";

type ProjectView = "backlog" | "board" | "calendar" | "gantt";

type MobileProjectNavProps = {
  workspaceId: string;
  projectId: string;
  projectName?: string;
  activeView: ProjectView;
  onSelectBoard: () => void;
  onSelectBacklog: () => void;
  onSelectCalendar: () => void;
  onSelectGantt: () => void;
  onSelectProject: (projectId: string) => void;
  onAddProject: () => void;
};

export default function MobileProjectNav({
  workspaceId,
  projectId,
  projectName,
  activeView,
  onSelectBoard,
  onSelectBacklog,
  onSelectCalendar,
  onSelectGantt,
  onSelectProject,
  onAddProject,
}: MobileProjectNavProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: projects = [] } = useGetProjects({ workspaceId });
  const currentProject = projects?.find((project) => project.id === projectId);
  const CurrentIcon =
    icons[currentProject?.icon as keyof typeof icons] || icons.Layout;

  const views: {
    id: ProjectView;
    label: string;
    icon: LucideIcon;
    onSelect: () => void;
  }[] = [
    {
      id: "backlog",
      label: t("tasks:view.backlog"),
      icon: SquircleDashed,
      onSelect: onSelectBacklog,
    },
    {
      id: "board",
      label: t("tasks:title"),
      icon: SquareKanban,
      onSelect: onSelectBoard,
    },
    {
      id: "calendar",
      label: t("tasks:calendar.title"),
      icon: CalendarRange,
      onSelect: onSelectCalendar,
    },
    {
      id: "gantt",
      label: t("tasks:view.gantt"),
      icon: CalendarDays,
      onSelect: onSelectGantt,
    },
  ];

  const select = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("navigation:projectList.switcherLabel")}
            className="h-8 min-w-0 max-w-full gap-1.5 px-2"
          />
        }
      >
        <CurrentIcon className="size-4 shrink-0" />
        <span className="truncate font-medium text-sm">
          {projectName ?? currentProject?.name}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {t("tasks:view.heading")}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {views.map(({ id, label, icon: Icon, onSelect }) => (
                <button
                  key={id}
                  type="button"
                  onClick={select(onSelect)}
                  aria-pressed={activeView === id}
                  className={cn(
                    "flex h-10 w-full items-center gap-2 rounded-md border px-2.5 text-sm font-medium transition-colors",
                    activeView === id
                      ? "border-border bg-secondary text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-accent",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <p className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {t("navigation:sidebar.projects")}
            </p>
            <div className="max-h-56 space-y-0.5 overflow-y-auto">
              {(projects ?? []).map((project) => {
                const Icon =
                  icons[project.icon as keyof typeof icons] || icons.Layout;
                const isCurrentProject = project.id === projectId;

                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={select(() => onSelectProject(project.id))}
                    className={cn(
                      "flex h-10 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm transition-colors",
                      isCurrentProject
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{project.name}</span>
                    {isCurrentProject && <Check className="size-4" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={select(onAddProject)}
            className="flex h-10 w-full items-center gap-2 rounded-md border border-border px-2.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
          >
            <Plus className="size-4" />
            {t("navigation:projectList.addProject")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

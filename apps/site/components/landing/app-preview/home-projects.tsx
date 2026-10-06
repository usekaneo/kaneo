import type { ProjectWithTasks } from "@/types/project";
import messages from "../../../../../i18n/en-US.json";
import { getCompletionPercentage } from "./assigned-tasks";
import { pluralMessage } from "./fill-message";
import { getProjectIcon } from "./project-icon";
import { SectionHeader } from "./section-header";

const copy = messages.workspace.home.projects;

export function HomeProjects({
  projects,
  onProjectSelect,
}: {
  projects: ProjectWithTasks[];
  onProjectSelect: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title={copy.title}
        action={
          <span className="shrink-0 text-[13px] font-medium text-muted-foreground">
            {copy.all}
          </span>
        }
      />
      <div className="grid grid-cols-3 gap-3">
        {projects.slice(0, 3).map((project) => {
          const ProjectIcon = getProjectIcon(project.icon);
          const completion = getCompletionPercentage(project);
          const totalTasks = project.columns.reduce(
            (sum, column) => sum + column.tasks.length,
            0,
          );

          return (
            <button
              key={project.id}
              type="button"
              onClick={() => onProjectSelect(project.id)}
              className="flex flex-col gap-3.5 rounded-lg border border-border p-3.5 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex w-full items-center gap-2">
                <ProjectIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {project.name}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {completion}%
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground/80"
                  style={{ width: `${completion}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {pluralMessage(
                  { one: copy.tasks_one, other: copy.tasks_other },
                  totalTasks,
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

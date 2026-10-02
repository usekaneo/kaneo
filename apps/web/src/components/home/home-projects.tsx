import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import icons from "@/constants/project-icons";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { SectionHeader } from "./section-header";

type HomeProjectsProps = {
  workspaceId: string;
};

const VISIBLE_PROJECTS = 3;

export function HomeProjects({ workspaceId }: HomeProjectsProps) {
  const { t } = useTranslation();
  const {
    data: projects,
    isPending,
    isError,
  } = useGetProjects({ workspaceId }, true);

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title={t("workspace:home.projects.title")}
        action={
          <Link
            to="/dashboard/workspace/$workspaceId/projects"
            params={{ workspaceId }}
            className="shrink-0 font-medium text-[13px] text-muted-foreground hover:text-foreground"
          >
            {t("workspace:home.projects.all")}
          </Link>
        }
      />
      {isPending ? (
        <Skeleton
          aria-label={t("common:empty.loading")}
          className="h-28 w-full"
        />
      ) : isError && !projects ? (
        <p role="alert" className="text-muted-foreground text-sm">
          {t("workspace:home.projects.loadError")}
        </p>
      ) : !projects?.length ? (
        <p className="text-muted-foreground text-sm">
          {t("workspace:projects.emptyTitle")}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {projects.slice(0, VISIBLE_PROJECTS).map((project) => {
            const ProjectIcon =
              icons[project.icon as keyof typeof icons] || icons.Layout;
            const { completionPercentage, totalTasks } = project.statistics;

            return (
              <Link
                key={project.id}
                to="/dashboard/workspace/$workspaceId/project/$projectId/board"
                params={{ workspaceId, projectId: project.id }}
                className="flex flex-col gap-3.5 rounded-lg border border-border p-3.5 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-center gap-2">
                  <ProjectIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground text-sm">
                    {project.name}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {completionPercentage}%
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground/80"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
                <span className="text-muted-foreground text-xs">
                  {t("workspace:home.projects.tasks", { count: totalTasks })}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

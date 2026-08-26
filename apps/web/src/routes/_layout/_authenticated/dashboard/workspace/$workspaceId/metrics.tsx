import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChartColumn, LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import ProjectMetricsDashboard, {
  ProjectMetricsSkeleton,
} from "@/components/metrics/project-metrics-dashboard";
import PageTitle from "@/components/page-title";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import icons from "@/constants/project-icons";
import useGetProjectMetrics from "@/hooks/queries/project/use-get-project-metrics";
import useGetProjects from "@/hooks/queries/project/use-get-projects";

type MetricsSearch = {
  projectId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/metrics",
)({
  validateSearch: (search: Record<string, unknown>): MetricsSearch => ({
    projectId:
      typeof search.projectId === "string" && search.projectId.length > 0
        ? search.projectId
        : undefined,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { projectId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const { data: projects, isLoading: isProjectsLoading } = useGetProjects({
    workspaceId,
  });
  const {
    data: metrics,
    isLoading: isMetricsLoading,
    isError,
    error,
  } = useGetProjectMetrics({ projectId });

  const selectedProject = projects?.find((project) => project.id === projectId);

  const handleProjectChange = (value: string | null) => {
    navigate({
      search: (prev: MetricsSearch) => ({
        ...prev,
        projectId: value || undefined,
      }),
      replace: true,
    });
  };

  return (
    <>
      <PageTitle title={t("workspace:metrics.pageTitle")} />
      <div
        className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
        data-tour="metrics-page"
      >
        <WorkspaceLayout
          title={t("workspace:metrics.pageTitle")}
          headerActions={
            <div
              className="min-w-[12rem] max-w-[18rem]"
              data-tour="metrics-project-select"
            >
              <Select
                value={projectId ?? null}
                onValueChange={handleProjectChange}
                disabled={isProjectsLoading || !projects?.length}
              >
                <SelectTrigger
                  size="sm"
                  aria-label={t("workspace:metrics.selectProject")}
                >
                  <SelectValue
                    placeholder={t("workspace:metrics.selectProject")}
                  >
                    {selectedProject ? (
                      <span className="flex items-center gap-2 truncate">
                        {(() => {
                          const Icon =
                            icons[selectedProject.icon as keyof typeof icons] ||
                            icons.Layout;
                          return (
                            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                          );
                        })()}
                        <span className="truncate">{selectedProject.name}</span>
                      </span>
                    ) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(projects ?? []).map((project) => {
                    const Icon =
                      icons[project.icon as keyof typeof icons] || icons.Layout;
                    return (
                      <SelectItem key={project.id} value={project.id}>
                        <span className="flex items-center gap-2">
                          <Icon className="size-3.5 text-muted-foreground" />
                          {project.name}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          }
        >
          {!projectId ? (
            <Empty className="min-h-[55vh]" data-tour="metrics-summary">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ChartColumn />
                </EmptyMedia>
                <EmptyTitle>{t("workspace:metrics.emptyTitle")}</EmptyTitle>
                <EmptyDescription>
                  {t("workspace:metrics.emptyDescription")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : isProjectsLoading || isMetricsLoading ? (
            <ProjectMetricsSkeleton />
          ) : isError ? (
            <Empty className="min-h-[55vh]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LayoutGrid />
                </EmptyMedia>
                <EmptyTitle>{t("workspace:metrics.errorTitle")}</EmptyTitle>
                <EmptyDescription>
                  {error instanceof Error
                    ? error.message
                    : t("workspace:metrics.errorDescription")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : metrics ? (
            <ProjectMetricsDashboard metrics={metrics} />
          ) : null}
        </WorkspaceLayout>
      </div>
    </>
  );
}

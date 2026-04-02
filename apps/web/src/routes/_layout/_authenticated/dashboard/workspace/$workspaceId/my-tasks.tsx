import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarClock,
  CalendarX,
  CheckCircle2,
  ChevronDown,
  Circle,
  LayoutGrid,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import MyTaskRow from "@/components/my-tasks/my-task-row";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ErrorDisplay } from "@/components/ui/error-display";
import { Skeleton } from "@/components/ui/skeleton";
import useGetMyTasks from "@/hooks/queries/task/use-get-my-tasks";
import { cn } from "@/lib/cn";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/my-tasks",
)({
  component: RouteComponent,
});

const summaryHighlights = [
  {
    icon: LayoutGrid,
    key: "assigned",
  },
  {
    icon: Circle,
    key: "pending",
  },
  {
    icon: CalendarClock,
    key: "dueToday",
  },
  {
    icon: CalendarX,
    key: "overdue",
  },
] as const;

const summarySkeletonKeys = [
  "assigned",
  "pending",
  "due-today",
  "overdue",
] as const;

const myTaskFilters = ["all", "overdue", "dueToday", "pending"] as const;
const activeGroupIds = ["overdue", "pending", "inProgress"] as const;

type MyTaskFilter = (typeof myTaskFilters)[number];

function getUtcDayKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function isDueToday(dueDate: string | null | undefined) {
  if (!dueDate) {
    return false;
  }

  return getUtcDayKey(new Date(dueDate)) === getUtcDayKey(new Date());
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { data, error, isLoading, refetch } = useGetMyTasks(workspaceId);
  const [isDoneOpen, setIsDoneOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<MyTaskFilter>("all");

  if (error) {
    return (
      <>
        <PageTitle title={t("workspace:myTasks.pageTitle")} />
        <WorkspaceLayout title={t("workspace:myTasks.pageTitle")}>
          <ErrorDisplay
            error={error}
            onRetry={() => {
              void refetch();
            }}
          />
        </WorkspaceLayout>
      </>
    );
  }

  if (isLoading || !data) {
    return (
      <>
        <PageTitle title={t("workspace:myTasks.pageTitle")} />
        <WorkspaceLayout title={t("workspace:myTasks.pageTitle")}>
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
            <div className="space-y-4 border-b border-border/60 pb-5">
              <div className="space-y-1">
                <Skeleton className="h-7 w-44" />
                <Skeleton className="h-4 w-80 max-w-full" />
              </div>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                {summarySkeletonKeys.map((key) => (
                  <div key={key} className="flex items-baseline gap-3">
                    <Skeleton className="h-8 w-10" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {summarySkeletonKeys.map((key) => (
                <Card key={key}>
                  <CardHeader className="gap-3">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-20 w-full" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </WorkspaceLayout>
      </>
    );
  }

  const groups = data.groups.reduce(
    (acc, group) => {
      acc[group.id] = group;
      return acc;
    },
    {} as Record<
      (typeof data.groups)[number]["id"],
      (typeof data.groups)[number]
    >,
  );

  const doneGroup = groups.done;
  const filterCounts = {
    all: data.summary.assigned,
    overdue: data.summary.overdue,
    dueToday: data.summary.dueToday,
    pending: data.summary.pending,
  } as const;

  const filteredGroups = activeGroupIds
    .map((groupId) => {
      const group = groups[groupId];

      if (!group) {
        return null;
      }

      if (activeFilter === "all") {
        return group;
      }

      if (activeFilter === "overdue") {
        return group.id === "overdue" ? group : { ...group, tasks: [] };
      }

      if (activeFilter === "pending") {
        return group.id === "pending" ? group : { ...group, tasks: [] };
      }

      if (activeFilter === "dueToday") {
        return {
          ...group,
          tasks: group.tasks.filter(
            (task) => !task.isFinal && isDueToday(task.dueDate),
          ),
        };
      }

      return group;
    })
    .filter(
      (
        group,
      ): group is Exclude<(typeof data.groups)[number], undefined | null> =>
        Boolean(group && group.tasks.length > 0),
    );

  const hasVisibleTasks = filteredGroups.length > 0;

  return (
    <>
      <PageTitle title={t("workspace:myTasks.pageTitle")} />
      <WorkspaceLayout title={t("workspace:myTasks.pageTitle")}>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
          <section className="space-y-4 border-b border-border/60 pb-5">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-semibold tracking-tight">
                {t("workspace:myTasks.heading")}
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {t("workspace:myTasks.subtitle")}
              </p>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                {summaryHighlights.map(({ icon: Icon, key }) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 text-foreground"
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        key === "assigned" && "text-blue-600",
                        key === "pending" && "text-amber-600",
                        key === "dueToday" && "text-orange-600",
                        key === "overdue" && "text-red-600",
                      )}
                    />
                    <span className="font-semibold">{data.summary[key]}</span>
                    <span className="text-muted-foreground">
                      {t(`workspace:myTasks.summary.${key}`)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {myTaskFilters.map((filter) => (
                  <Button
                    key={filter}
                    type="button"
                    variant={activeFilter === filter ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "rounded-full px-3",
                      activeFilter === filter &&
                        "shadow-[0_8px_30px_-18px_color-mix(in_srgb,var(--primary)_65%,transparent)]",
                    )}
                    onClick={() => setActiveFilter(filter)}
                  >
                    {t(`workspace:myTasks.filters.${filter}`)}
                    <span className="ml-2 text-[11px] opacity-75">
                      {filterCounts[filter]}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          </section>

          {data.summary.assigned === 0 ? (
            <Card className="border-dashed bg-muted/10 py-12">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-muted/50 text-muted-foreground ring-8 ring-muted/20">
                  <LayoutGrid className="h-10 w-10 opacity-50" />
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight">
                  {t("workspace:myTasks.emptyTitle")}
                </CardTitle>
                <CardDescription className="mx-auto max-w-sm text-base">
                  {t("workspace:myTasks.emptyDescription")}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredGroups.map((group) => {
                return (
                  <section key={group.id} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full ring-4 ring-background",
                          group.id === "overdue" && "bg-red-500",
                          group.id === "pending" && "bg-amber-500",
                          group.id === "inProgress" && "bg-blue-500",
                        )}
                      />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
                        {t(`workspace:myTasks.groups.${group.id}`, {
                          defaultValue: group.title,
                        })}
                        <span className="ml-2 font-medium lowercase tracking-normal text-muted-foreground/40">
                          (
                          {t("workspace:myTasks.taskCount", {
                            count: group.tasks.length,
                          })}
                          )
                        </span>
                      </h3>
                    </div>

                    <div className="grid gap-3">
                      {group.tasks.map((task) => (
                        <MyTaskRow
                          key={task.id}
                          task={task}
                          workspaceId={workspaceId}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}

              {!hasVisibleTasks && (
                <Card className="border-dashed bg-muted/10">
                  <CardHeader>
                    <CardTitle>
                      {activeFilter === "all"
                        ? t("workspace:myTasks.noActiveTasksTitle")
                        : t("workspace:myTasks.filteredEmptyTitle")}
                    </CardTitle>
                    <CardDescription>
                      {activeFilter === "all"
                        ? t("workspace:myTasks.noActiveTasksDescription")
                        : t("workspace:myTasks.filteredEmptyDescription", {
                            filter: t(
                              `workspace:myTasks.filters.${activeFilter}`,
                            ),
                          })}
                    </CardDescription>
                    {activeFilter !== "all" && (
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveFilter("all")}
                        >
                          {t("common:actions.reset")}
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                </Card>
              )}

              {activeFilter === "all" &&
                doneGroup &&
                doneGroup.tasks.length > 0 && (
                  <Collapsible
                    open={isDoneOpen}
                    onOpenChange={setIsDoneOpen}
                    className="overflow-hidden rounded-3xl border border-border/60 bg-muted/5 transition-all duration-200"
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left transition-colors duration-200 hover:bg-muted/10"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-success/10 text-success">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold tracking-tight">
                              {t("workspace:myTasks.groups.done", {
                                defaultValue: doneGroup.title,
                              })}
                            </h3>
                            <p className="font-medium text-muted-foreground/60 text-sm">
                              {t("workspace:myTasks.taskCount", {
                                count: doneGroup.tasks.length,
                              })}
                            </p>
                          </div>
                        </div>

                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-xl bg-muted/40 text-muted-foreground transition-all duration-300",
                            isDoneOpen && "rotate-180 bg-muted/60",
                          )}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="space-y-3 px-6 pb-6">
                      {doneGroup.tasks.map((task) => (
                        <MyTaskRow
                          key={task.id}
                          task={task}
                          workspaceId={workspaceId}
                        />
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
            </div>
          )}
        </div>
      </WorkspaceLayout>
    </>
  );
}

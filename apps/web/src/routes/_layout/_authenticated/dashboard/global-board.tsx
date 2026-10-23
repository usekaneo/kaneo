import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SquareKanban } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import Layout from "@/components/common/layout";
import { GlobalBoard } from "@/components/global-board";
import {
  type GlobalBoardFilters,
  parseGlobalBoardFilters,
} from "@/components/global-board/global-board-filters";
import { GlobalBoardToolbar } from "@/components/global-board/global-board-toolbar";
import PageTitle from "@/components/page-title";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import useGlobalBoardMeta from "@/hooks/queries/task/use-global-board-meta";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/global-board",
)({
  validateSearch: parseGlobalBoardFilters,
  component: GlobalBoardPage,
});

function GlobalBoardPage() {
  const { t } = useTranslation();
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: meta, isLoading, isError } = useGlobalBoardMeta();

  const setFilters = useCallback(
    (next: GlobalBoardFilters) =>
      navigate({ search: parseGlobalBoardFilters(next), replace: true }),
    [navigate],
  );

  return (
    <>
      <PageTitle title={t("tasks:globalBoard.pageTitle")} />
      <Layout>
        <Layout.Header>
          <div className="flex w-full items-center gap-1">
            <SidebarTrigger className="-ml-1 h-6 w-6" />
            <Separator
              orientation="vertical"
              className="mx-1.5 data-[orientation=vertical]:h-2.5"
            />
            <h1 className="text-card-foreground text-xs">
              {t("tasks:globalBoard.pageTitle")}
            </h1>
          </div>
        </Layout.Header>
        <Layout.Content>
          <div className="flex h-full min-h-0 flex-col">
            {isLoading ? (
              <div className="flex gap-4 p-4 md:px-5">
                {[0, 1, 2].map((lane) => (
                  <Skeleton
                    key={lane}
                    className="h-64 min-w-[min(20rem,calc(100vw-4.5rem))] flex-1 rounded-xl"
                  />
                ))}
              </div>
            ) : isError || !meta ? (
              <p role="alert" className="p-6 text-muted-foreground text-sm">
                {t("tasks:globalBoard.loadError")}
              </p>
            ) : meta.projects.length === 0 ? (
              <Empty className="min-h-[60vh]">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SquareKanban />
                  </EmptyMedia>
                  <EmptyTitle>{t("tasks:globalBoard.emptyTitle")}</EmptyTitle>
                  <EmptyDescription>
                    {t("tasks:globalBoard.emptyDescription")}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <>
                <GlobalBoardToolbar
                  meta={meta}
                  filters={filters}
                  onChange={setFilters}
                />
                <GlobalBoard meta={meta} filters={filters} />
              </>
            )}
          </div>
        </Layout.Content>
      </Layout>
    </>
  );
}

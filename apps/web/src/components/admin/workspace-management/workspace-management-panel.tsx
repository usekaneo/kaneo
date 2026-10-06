import {
  Building2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsPage } from "@/components/settings/settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import useAdminWorkspaces, {
  ADMIN_WORKSPACES_PAGE_SIZE,
  ADMIN_WORKSPACES_SEARCH_MAX_LENGTH,
  type AdminWorkspace,
} from "@/hooks/queries/admin/use-admin-workspaces";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import WorkspaceMembersDialog from "./workspace-members-dialog";
import WorkspaceTableRow from "./workspace-table-row";

const COLUMN_COUNT = 6;

function WorkspaceManagementPanel() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [searchedFor, setSearchedFor] = useState(debouncedSearch);
  const [page, setPage] = useState(0);
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<AdminWorkspace | null>(null);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  if (debouncedSearch !== searchedFor) {
    setSearchedFor(debouncedSearch);
    setPage(0);
  }

  const { data, isLoading, isFetching, isError, refetch } = useAdminWorkspaces(
    debouncedSearch,
    page,
  );

  const total = data?.total ?? 0;
  const isSearchActive = debouncedSearch.trim().length > 0;
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_WORKSPACES_PAGE_SIZE));

  useEffect(() => {
    if (data && page >= pageCount) {
      setPage(pageCount - 1);
    }
  }, [data, page, pageCount]);

  return (
    <SettingsPage
      className="max-w-5xl"
      title={
        <span className="flex items-center gap-2">
          {t("settings:adminWorkspaces.title")}
          <Badge variant="outline" size="sm">
            {t("settings:adminWorkspaces.instanceBadge")}
          </Badge>
        </span>
      }
      description={t("settings:adminWorkspaces.subtitle")}
    >
      <section className="overflow-hidden rounded-xl border bg-card shadow-xs/5">
        <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-sm font-medium">
                {t("settings:adminWorkspaces.directoryTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isSearchActive
                  ? t("settings:adminWorkspaces.searchCount", { count: total })
                  : t("settings:adminWorkspaces.workspaceCount", {
                      count: total,
                    })}
              </p>
            </div>
            {isFetching && !isLoading ? (
              <RefreshCwIcon
                aria-label={t("settings:adminWorkspaces.refreshing")}
                className="animate-spin text-muted-foreground"
              />
            ) : null}
          </div>

          <InputGroup className="w-full sm:w-72">
            <InputGroupInput
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={ADMIN_WORKSPACES_SEARCH_MAX_LENGTH}
              placeholder={t("settings:adminWorkspaces.searchPlaceholder")}
              aria-label={t("settings:adminWorkspaces.searchLabel")}
            />
            <InputGroupAddon align="inline-start">
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
          </InputGroup>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-6">
                  {t("settings:adminWorkspaces.columns.workspace")}
                </TableHead>
                <TableHead>
                  {t("settings:adminWorkspaces.columns.owners")}
                </TableHead>
                <TableHead>
                  {t("settings:adminWorkspaces.columns.members")}
                </TableHead>
                <TableHead>
                  {t("settings:adminWorkspaces.columns.projects")}
                </TableHead>
                <TableHead>
                  {t("settings:adminWorkspaces.columns.created")}
                </TableHead>
                <TableHead className="w-px pe-6">
                  <span className="sr-only">
                    {t("settings:adminWorkspaces.columns.actions")}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? ["first", "second", "third", "fourth", "fifth"].map(
                    (skeleton) => (
                      <TableRow key={skeleton}>
                        <TableCell className="ps-6 py-3" colSpan={COLUMN_COUNT}>
                          <Skeleton className="h-9 w-full" />
                        </TableCell>
                      </TableRow>
                    ),
                  )
                : null}

              {!isLoading && isError ? (
                <TableRow>
                  <TableCell
                    colSpan={COLUMN_COUNT}
                    className="h-56 text-center"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm text-muted-foreground">
                        {t("settings:adminWorkspaces.loadError")}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                      >
                        <RefreshCwIcon aria-hidden="true" />
                        {t("settings:adminWorkspaces.retry")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading && !isError && data?.workspaces.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={COLUMN_COUNT}
                    className="h-56 text-center"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Building2Icon aria-hidden="true" />
                      </div>
                      <p className="text-sm font-medium">
                        {t("settings:adminWorkspaces.emptyTitle")}
                      </p>
                      <p className="max-w-sm text-xs text-muted-foreground">
                        {t("settings:adminWorkspaces.emptyDescription")}
                      </p>
                      {search ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSearch("")}
                        >
                          {t("settings:adminWorkspaces.clearSearch")}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading && !isError
                ? data?.workspaces.map((workspace) => (
                    <WorkspaceTableRow
                      key={workspace.id}
                      workspace={workspace}
                      onManage={() => {
                        setSelectedWorkspace(workspace);
                        setIsMembersOpen(true);
                      }}
                    />
                  ))
                : null}
            </TableBody>
          </Table>
        </div>

        {!isLoading && !isError ? (
          <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("settings:adminWorkspaces.pagination", {
                current: page + 1,
                total: pageCount,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page === 0 || isFetching}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              >
                <ChevronLeftIcon aria-hidden="true" />
                {t("settings:adminWorkspaces.previous")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page + 1 >= pageCount || isFetching}
                onClick={() => setPage((value) => value + 1)}
              >
                {t("settings:adminWorkspaces.next")}
                <ChevronRightIcon aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <WorkspaceMembersDialog
        workspace={selectedWorkspace}
        open={isMembersOpen}
        onOpenChange={setIsMembersOpen}
      />
    </SettingsPage>
  );
}

export default WorkspaceManagementPanel;

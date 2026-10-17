import { Building2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DirectoryErrorRow } from "@/components/admin/directory/directory-error-row";
import { DirectoryHeading } from "@/components/admin/directory/directory-heading";
import { DirectoryPagination } from "@/components/admin/directory/directory-pagination";
import { DirectorySearchInput } from "@/components/admin/directory/directory-search-input";
import { DirectorySkeletonRows } from "@/components/admin/directory/directory-skeleton-rows";
import { getPageCount } from "@/components/admin/directory/get-page-count";
import { useDirectoryPaging } from "@/components/admin/directory/use-directory-paging";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import useAdminWorkspaces, {
  ADMIN_WORKSPACES_PAGE_SIZE,
  ADMIN_WORKSPACES_SEARCH_MAX_LENGTH,
  type AdminWorkspace,
} from "@/hooks/queries/admin/use-admin-workspaces";
import { WorkspaceDirectoryHead } from "./workspace-directory-head";
import { WorkspaceDirectoryRow } from "./workspace-directory-row";
import WorkspaceMembersDialog from "./workspace-members-dialog";

function WorkspaceManagementPanel() {
  const { t } = useTranslation();
  const { search, setSearch, debouncedSearch, page, setPage } =
    useDirectoryPaging();
  const [selectedWorkspace, setSelectedWorkspace] =
    useState<AdminWorkspace | null>(null);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  const { data, isLoading, isFetching, isError, refetch } = useAdminWorkspaces(
    debouncedSearch,
    page,
  );

  const total = data?.total ?? 0;
  const pageCount = getPageCount(total, ADMIN_WORKSPACES_PAGE_SIZE);
  const workspaces = data?.workspaces ?? [];
  const isSearchActive = debouncedSearch.trim().length > 0;
  const hasError = !isLoading && isError;
  const isEmpty = !isLoading && !isError && workspaces.length === 0;
  const countLabel = !data
    ? undefined
    : isSearchActive
      ? t("settings:adminWorkspaces.searchCount", { count: total })
      : total;

  if (data && page >= pageCount) {
    setPage(pageCount - 1);
  }

  return (
    <SettingsPage
      title={t("settings:adminWorkspaces.title")}
      description={t("settings:adminWorkspaces.subtitle")}
    >
      <SettingsSection
        title={
          <DirectoryHeading
            title={t("settings:adminWorkspaces.directoryTitle")}
            count={countLabel}
            refreshingLabel={
              isFetching && !isLoading
                ? t("settings:adminWorkspaces.refreshing")
                : undefined
            }
          />
        }
        action={
          <DirectorySearchInput
            value={search}
            onValueChange={setSearch}
            maxLength={ADMIN_WORKSPACES_SEARCH_MAX_LENGTH}
            placeholder={t("settings:adminWorkspaces.searchPlaceholder")}
            label={t("settings:adminWorkspaces.searchLabel")}
          />
        }
      >
        <SettingsCard>
          {hasError ? (
            <DirectoryErrorRow
              message={t("settings:adminWorkspaces.loadError")}
              retryLabel={t("settings:adminWorkspaces.retry")}
              onRetry={() => refetch()}
            />
          ) : isEmpty ? (
            <SettingsEmpty
              icon={<Building2Icon />}
              title={t("settings:adminWorkspaces.emptyTitle")}
              description={t("settings:adminWorkspaces.emptyDescription")}
              action={
                search ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearch("")}
                  >
                    {t("settings:adminWorkspaces.clearSearch")}
                  </Button>
                ) : null
              }
            />
          ) : (
            <div
              role="table"
              aria-label={t("settings:adminWorkspaces.directoryTitle")}
              className="divide-y divide-border"
            >
              <WorkspaceDirectoryHead />
              {isLoading ? (
                <DirectorySkeletonRows />
              ) : (
                workspaces.map((workspace) => (
                  <WorkspaceDirectoryRow
                    key={workspace.id}
                    workspace={workspace}
                    onManage={() => {
                      setSelectedWorkspace(workspace);
                      setIsMembersOpen(true);
                    }}
                  />
                ))
              )}
            </div>
          )}
          {!isLoading && !isError && !isEmpty ? (
            <DirectoryPagination
              page={page}
              pageCount={pageCount}
              disabled={isFetching}
              onPageChange={setPage}
              label={t("settings:adminWorkspaces.pagination", {
                current: page + 1,
                total: pageCount,
              })}
              previousLabel={t("settings:adminWorkspaces.previous")}
              nextLabel={t("settings:adminWorkspaces.next")}
            />
          ) : null}
        </SettingsCard>
      </SettingsSection>

      <WorkspaceMembersDialog
        workspace={selectedWorkspace}
        open={isMembersOpen}
        onOpenChange={setIsMembersOpen}
      />
    </SettingsPage>
  );
}

export default WorkspaceManagementPanel;

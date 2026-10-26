import { UserPlusIcon, UsersRoundIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DirectoryErrorRow } from "@/components/admin/directory/directory-error-row";
import { DirectoryHeading } from "@/components/admin/directory/directory-heading";
import { DirectoryPagination } from "@/components/admin/directory/directory-pagination";
import { DirectorySearchInput } from "@/components/admin/directory/directory-search-input";
import { DirectorySkeletonRows } from "@/components/admin/directory/directory-skeleton-rows";
import { getPageCount } from "@/components/admin/directory/get-page-count";
import { useDirectoryPaging } from "@/components/admin/directory/use-directory-paging";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import useAdminUsers, {
  ADMIN_USERS_PAGE_SIZE,
  ADMIN_USERS_SEARCH_MAX_LENGTH,
  type AdminUser,
} from "@/hooks/queries/admin/use-admin-users";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import { CreateUserDialog } from "./create-user-dialog";
import { EditUserDialog } from "./edit-user-dialog";
import type { PendingUserAction } from "./pending-user-action";
import { UserConfirmDialog } from "./user-confirm-dialog";
import { UserDirectoryHead } from "./user-directory-head";
import { UserDirectoryFilters } from "./user-directory-filters";
import { UserDirectoryRow } from "./user-directory-row";
import {
  hasUserFilters,
  NO_USER_FILTERS,
  toAdminUserFilters,
  type UserFilterValues,
} from "./user-filters";

function UserManagementPanel() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { search, setSearch, debouncedSearch, page, setPage } =
    useDirectoryPaging();
  const { data: config } = useGetConfig();
  const [filters, setFilters] = useState<UserFilterValues>(NO_USER_FILTERS);
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingUserAction | null>(
    null,
  );

  const { data, isLoading, isFetching, isError, refetch } = useAdminUsers(
    debouncedSearch,
    page,
    toAdminUserFilters(filters),
  );

  const total = data?.total ?? 0;
  const pageCount = getPageCount(total, ADMIN_USERS_PAGE_SIZE);
  const users = data?.users ?? [];
  const isSearchActive =
    debouncedSearch.trim().length > 0 || hasUserFilters(filters);
  const hasError = !isLoading && isError;
  const isEmpty = !isLoading && !isError && users.length === 0;
  const countLabel = !data
    ? undefined
    : isSearchActive
      ? t("settings:adminUsers.searchCount", { count: total })
      : total;

  if (data && page >= pageCount) {
    setPage(pageCount - 1);
  }

  const changeFilters = (next: UserFilterValues) => {
    setFilters(next);
    setPage(0);
  };

  return (
    <SettingsPage
      title={t("settings:adminUsers.title")}
      description={t("settings:adminUsers.subtitle")}
      actions={
        <Button type="button" size="sm" onClick={() => setIsCreating(true)}>
          <UserPlusIcon aria-hidden="true" />
          {t("settings:adminUsers.create.open")}
        </Button>
      }
    >
      <SettingsSection
        title={
          <DirectoryHeading
            title={t("settings:adminUsers.directoryTitle")}
            count={countLabel}
            refreshingLabel={
              isFetching && !isLoading
                ? t("settings:adminUsers.refreshing")
                : undefined
            }
          />
        }
        action={
          <DirectorySearchInput
            value={search}
            onValueChange={setSearch}
            maxLength={ADMIN_USERS_SEARCH_MAX_LENGTH}
            placeholder={t("settings:adminUsers.searchPlaceholder")}
            label={t("settings:adminUsers.searchLabel")}
          />
        }
      >
        <UserDirectoryFilters values={filters} onChange={changeFilters} />
        <SettingsCard>
          {hasError ? (
            <DirectoryErrorRow
              message={t("settings:adminUsers.loadError")}
              retryLabel={t("settings:adminUsers.retry")}
              onRetry={() => refetch()}
            />
          ) : isEmpty ? (
            <SettingsEmpty
              icon={<UsersRoundIcon />}
              title={t("settings:adminUsers.emptyTitle")}
              description={t("settings:adminUsers.emptyDescription")}
              action={
                search || hasUserFilters(filters) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      changeFilters(NO_USER_FILTERS);
                    }}
                  >
                    {t("settings:adminUsers.clearSearch")}
                  </Button>
                ) : null
              }
            />
          ) : (
            <div
              role="table"
              aria-label={t("settings:adminUsers.directoryTitle")}
              className="divide-y divide-border"
            >
              <UserDirectoryHead />
              {isLoading ? (
                <DirectorySkeletonRows withAvatar />
              ) : (
                users.map((user) => (
                  <UserDirectoryRow
                    key={user.id}
                    user={user}
                    isSelf={user.id === currentUser?.id}
                    canSendPasswordReset={config?.disableLoginForm !== true}
                    onEdit={() => setEditingUser(user)}
                    onAction={(type) => setPendingAction({ type, user })}
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
              label={t("settings:adminUsers.pagination", {
                current: page + 1,
                total: pageCount,
              })}
              previousLabel={t("settings:adminUsers.previous")}
              nextLabel={t("settings:adminUsers.next")}
            />
          ) : null}
        </SettingsCard>
      </SettingsSection>

      <CreateUserDialog open={isCreating} onOpenChange={setIsCreating} />

      <EditUserDialog
        user={editingUser}
        currentUserId={currentUser?.id}
        onClose={() => setEditingUser(null)}
      />

      <UserConfirmDialog
        action={pendingAction}
        onClose={() => setPendingAction(null)}
      />
    </SettingsPage>
  );
}

export default UserManagementPanel;

import { ScrollTextIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DirectoryErrorRow } from "@/components/admin/directory/directory-error-row";
import { DirectoryHeading } from "@/components/admin/directory/directory-heading";
import { DirectoryPagination } from "@/components/admin/directory/directory-pagination";
import { DirectorySkeletonRows } from "@/components/admin/directory/directory-skeleton-rows";
import { getPageCount } from "@/components/admin/directory/get-page-count";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import useAdminAuditLog, {
  ADMIN_AUDIT_LOG_PAGE_SIZE,
} from "@/hooks/queries/admin/use-admin-audit-log";
import { AuditLogCategorySelect } from "./audit-log-category-select";
import { AuditLogHead } from "./audit-log-head";
import { AuditLogRow } from "./audit-log-row";

function AuditLogPanel() {
  const { t } = useTranslation();
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const { data, isLoading, isFetching, isError, refetch } = useAdminAuditLog(
    category,
    page,
  );

  const total = data?.total ?? 0;
  const pageCount = getPageCount(total, ADMIN_AUDIT_LOG_PAGE_SIZE);
  const entries = data?.entries ?? [];
  const hasError = !isLoading && isError;
  const isEmpty = !isLoading && !isError && entries.length === 0;

  if (data && page >= pageCount) {
    setPage(pageCount - 1);
  }

  return (
    <SettingsPage title={t("settings:adminAuditLog.title")}>
      <SettingsSection
        title={
          <DirectoryHeading
            title={t("settings:adminAuditLog.directoryTitle")}
            count={data ? total : undefined}
            refreshingLabel={
              isFetching && !isLoading
                ? t("settings:adminAuditLog.refreshing")
                : undefined
            }
          />
        }
        action={
          <AuditLogCategorySelect
            value={category}
            onValueChange={(next) => {
              setCategory(next);
              setPage(0);
            }}
          />
        }
      >
        <SettingsCard>
          {hasError ? (
            <DirectoryErrorRow
              message={t("settings:adminAuditLog.loadError")}
              retryLabel={t("settings:adminAuditLog.retry")}
              onRetry={() => refetch()}
            />
          ) : isEmpty ? (
            <SettingsEmpty
              icon={<ScrollTextIcon />}
              title={t("settings:adminAuditLog.emptyTitle")}
              action={
                category ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCategory("")}
                  >
                    {t("settings:adminAuditLog.clearFilter")}
                  </Button>
                ) : null
              }
            />
          ) : (
            <div
              role="table"
              aria-label={t("settings:adminAuditLog.directoryTitle")}
              className="divide-y divide-border"
            >
              <AuditLogHead />
              {isLoading ? (
                <DirectorySkeletonRows />
              ) : (
                entries.map((entry) => (
                  <AuditLogRow key={entry.id} entry={entry} />
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
              label={t("settings:adminAuditLog.pagination", {
                current: page + 1,
                total: pageCount,
              })}
              previousLabel={t("settings:adminAuditLog.previous")}
              nextLabel={t("settings:adminAuditLog.next")}
            />
          ) : null}
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}

export default AuditLogPanel;

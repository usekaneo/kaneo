import { CalendarIcon, LockIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarFeed } from "@/components/project/calendar-feeds/calendar-feed";
import { CalendarFeedRow } from "@/components/project/calendar-feeds/calendar-feed-row";
import { NewCalendarFeedDialog } from "@/components/project/calendar-feeds/new-calendar-feed-dialog";
import { RevokeCalendarFeedDialog } from "@/components/project/calendar-feeds/revoke-calendar-feed-dialog";
import { useCalendarFeeds } from "@/components/project/calendar-feeds/use-calendar-feeds";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import { SettingsNote } from "@/components/settings/settings-note";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export function CalendarFeedSettings({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { workspace, canShareProjects, isCheckingPermissions } =
    useWorkspacePermission();
  const canShare = canShareProjects();
  const workspaceId = workspace?.id ?? "";
  const labelsQuery = useGetLabelsByWorkspace(workspaceId);
  const feedsQuery = useCalendarFeeds(projectId, canShare);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokingFeedId, setRevokingFeedId] = useState<string | null>(null);

  const title = t("settings:calendarFeeds.title");
  const description = t("settings:calendarFeeds.subtitle");

  if (isCheckingPermissions || !canShare) {
    return (
      <SettingsPage title={title} description={description}>
        <p className="text-muted-foreground text-sm">
          {t(
            isCheckingPermissions
              ? "common:empty.loading"
              : "settings:calendarFeeds.permissionRequired",
          )}
        </p>
      </SettingsPage>
    );
  }

  const feeds = feedsQuery.data ?? [];
  const timeZones =
    feeds.length > 0
      ? [...new Set(feeds.map((feed) => feed.timeZone))]
      : [Intl.DateTimeFormat().resolvedOptions().timeZone];

  const openRevokeDialog = (feed: CalendarFeed) => {
    setRevokingFeedId(feed.id);
    setRevokeOpen(true);
  };

  const newFeedButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setCreateOpen(true)}
    >
      <PlusIcon aria-hidden="true" />
      {t("settings:calendarFeeds.newFeed")}
    </Button>
  );

  const renderFeeds = () => {
    if (feedsQuery.isPending) {
      return <SettingsRowsSkeleton rows={2} withDescription />;
    }
    if (feedsQuery.isError) {
      return (
        <p
          role="alert"
          className="px-4 py-3.5 text-destructive-foreground text-sm"
        >
          {t("settings:calendarFeeds.loadError")}
        </p>
      );
    }
    if (feeds.length === 0) {
      return (
        <SettingsEmpty
          icon={<CalendarIcon />}
          title={t("settings:calendarFeeds.emptyTitle")}
          description={t("settings:calendarFeeds.emptyDescription")}
          action={newFeedButton}
        />
      );
    }
    return feeds.map((feed) => (
      <CalendarFeedRow
        key={feed.id}
        feed={feed}
        labels={labelsQuery.data ?? []}
        onRevoke={openRevokeDialog}
      />
    ));
  };

  return (
    <>
      <SettingsPage
        title={title}
        description={description}
        actions={newFeedButton}
      >
        <SettingsSection
          title={t("settings:calendarFeeds.activeFeeds")}
          description={t("settings:calendarFeeds.subscribeHint")}
        >
          <SettingsCard>{renderFeeds()}</SettingsCard>
          <SettingsNote icon={LockIcon}>
            {t("settings:calendarFeeds.accessHint")}{" "}
            {t("settings:calendarFeeds.timeZoneHint", {
              timeZone: timeZones.join(", "),
            })}
          </SettingsNote>
        </SettingsSection>
      </SettingsPage>

      <NewCalendarFeedDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        workspaceId={workspaceId}
      />
      <RevokeCalendarFeedDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        projectId={projectId}
        feedId={revokingFeedId}
      />
    </>
  );
}

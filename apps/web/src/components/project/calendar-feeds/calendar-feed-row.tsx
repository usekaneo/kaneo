import { CalendarIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CalendarFeed } from "@/components/project/calendar-feeds/calendar-feed";
import { CopyFeedLinkButton } from "@/components/project/calendar-feeds/copy-feed-link-button";
import { resolveFeedLabels } from "@/components/project/calendar-feeds/resolve-feed-labels";
import { LabelPill } from "@/components/settings/labels/label-pill";
import type { WorkspaceLabel } from "@/components/settings/labels/workspace-label";
import { RowActionsMenu } from "@/components/settings/row-actions-menu";
import { SettingsRow } from "@/components/settings/settings-row";
import { getCalendarFeedUrl } from "@/fetchers/calendar-feed";

type CalendarFeedRowProps = {
  feed: CalendarFeed;
  labels: WorkspaceLabel[];
  onRevoke: (feed: CalendarFeed) => void;
};

export function CalendarFeedRow({
  feed,
  labels,
  onRevoke,
}: CalendarFeedRowProps) {
  const { t } = useTranslation();
  const url = getCalendarFeedUrl(feed.token);
  const feedLabels = resolveFeedLabels(feed.labelIds, labels);

  return (
    <SettingsRow
      icon={<CalendarIcon />}
      title={
        feedLabels.length > 0 ? (
          <span className="flex flex-wrap gap-1.5">
            {feedLabels.map((label) => (
              <LabelPill
                key={label.id}
                name={label.name ?? t("settings:calendarFeeds.deletedLabel")}
                color={label.color}
                className={label.name ? undefined : "text-muted-foreground"}
              />
            ))}
          </span>
        ) : (
          t("settings:calendarFeeds.allScheduledTasks")
        )
      }
      description={
        <span className="block truncate font-mono" title={url}>
          {url}
        </span>
      }
    >
      <CopyFeedLinkButton url={url} />
      <RowActionsMenu
        label={t("settings:calendarFeeds.feedActions")}
        actions={[
          {
            id: "revoke",
            label: t("settings:calendarFeeds.revoke"),
            icon: Trash2Icon,
            destructive: true,
            onSelect: () => onRevoke(feed),
          },
        ]}
      />
    </SettingsRow>
  );
}

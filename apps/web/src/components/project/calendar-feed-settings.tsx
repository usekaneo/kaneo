import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCalendarFeed,
  getCalendarFeeds,
  getCalendarFeedUrl,
  revokeCalendarFeed,
} from "@/fetchers/calendar-feed";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

type LabelOption = { value: string; label: string };

export function CalendarFeedSettings({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const { workspace, canShareProjects, isCheckingPermissions } =
    useWorkspacePermission();
  const canShare = canShareProjects();
  const labelsQuery = useGetLabelsByWorkspace(workspace?.id ?? "");
  const labels = labelsQuery.data ?? [];
  // Labels have separate IDs for the workspace definition and each task copy.
  const byName = new Map<string, (typeof labels)[number]>();
  for (const label of labels) {
    if (!byName.has(label.name) || label.taskId === null)
      byName.set(label.name, label);
  }
  const options = [...byName.values()]
    .map((label) => ({ value: label.id, label: label.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const [selected, setSelected] = useState<LabelOption[]>([]);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const queryClient = useQueryClient();
  const queryKey = ["calendar-feeds", projectId];
  const feedsQuery = useQuery({
    queryKey,
    queryFn: () => getCalendarFeeds(projectId),
    enabled: canShare,
  });
  const create = useMutation({
    mutationFn: () =>
      createCalendarFeed(
        projectId,
        selected.map((label) => label.value),
        timeZone,
      ),
    onSuccess: async () => {
      setSelected([]);
      await queryClient.invalidateQueries({
        queryKey: ["labels", workspace?.id],
      });
      await queryClient.invalidateQueries({ queryKey });
      toast.success(t("settings:calendarFeeds.created"));
    },
    onError: () => toast.error(t("settings:calendarFeeds.createError")),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeCalendarFeed(projectId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success(t("settings:calendarFeeds.revoked"));
    },
    onError: () => toast.error(t("settings:calendarFeeds.revokeError")),
  });

  if (isCheckingPermissions)
    return (
      <p className="text-sm text-muted-foreground">
        {t("common:empty.loading")}
      </p>
    );
  if (!canShare)
    return (
      <p className="text-sm text-muted-foreground">
        {t("settings:calendarFeeds.permissionRequired")}
      </p>
    );

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border border-border p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">
            {t("settings:calendarFeeds.createTitle")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("settings:calendarFeeds.filterHint")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="calendar-feed-labels">
            {t("settings:calendarFeeds.labels")}
          </Label>
          <Combobox
            items={options}
            multiple
            value={selected}
            onValueChange={setSelected}
            isItemEqualToValue={(item, value) => item.value === value.value}
            disabled={
              create.isPending || labelsQuery.isLoading || labelsQuery.isError
            }
          >
            <ComboboxChips>
              <ComboboxValue>
                {(value: LabelOption[]) => (
                  <>
                    {value.map((item) => (
                      <ComboboxChip aria-label={item.label} key={item.value}>
                        {item.label}
                      </ComboboxChip>
                    ))}
                    <ComboboxChipsInput
                      id="calendar-feed-labels"
                      placeholder={t("settings:calendarFeeds.selectLabels")}
                    />
                  </>
                )}
              </ComboboxValue>
            </ComboboxChips>
            <ComboboxPopup>
              <ComboboxEmpty>
                {t("settings:calendarFeeds.noLabels")}
              </ComboboxEmpty>
              <ComboboxList>
                {(item: LabelOption) => (
                  <ComboboxItem key={item.value} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxPopup>
          </Combobox>
          {labelsQuery.isError && (
            <p role="alert" className="text-xs text-destructive">
              {t("settings:calendarFeeds.loadError")}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("settings:calendarFeeds.timeZoneHint", { timeZone })}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("settings:calendarFeeds.accessHint")}
        </p>
        <Button
          disabled={
            !selected.length ||
            selected.length > 100 ||
            create.isPending ||
            labelsQuery.isError
          }
          onClick={() => create.mutate()}
        >
          {t(
            create.isPending
              ? "settings:calendarFeeds.creating"
              : "settings:calendarFeeds.create",
          )}
        </Button>
      </div>
      <div className="space-y-3">
        <h2 className="text-sm font-medium">
          {t("settings:calendarFeeds.activeFeeds")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("settings:calendarFeeds.subscribeHint")}
        </p>
        {feedsQuery.isLoading && (
          <p className="text-sm text-muted-foreground">
            {t("common:empty.loading")}
          </p>
        )}
        {feedsQuery.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t("settings:calendarFeeds.loadError")}
          </p>
        )}
        {feedsQuery.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("settings:calendarFeeds.empty")}
          </p>
        )}
        {feedsQuery.data?.map((feed) => {
          const url = getCalendarFeedUrl(feed.token);
          return (
            <div
              key={feed.id}
              className="space-y-3 rounded-xl border border-border p-4"
            >
              <p className="text-sm font-medium">
                {feed.labelIds
                  .map(
                    (id) =>
                      labels.find((label) => label.id === id)?.name ??
                      t("settings:calendarFeeds.deletedLabel"),
                  )
                  .join(", ")}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  aria-label={t("settings:calendarFeeds.feedUrl")}
                  readOnly
                  value={url}
                  className="min-w-0 flex-1"
                  onFocus={(event) => event.target.select()}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success(t("settings:calendarFeeds.copied"));
                      } catch {
                        toast.error(t("settings:calendarFeeds.copyError"));
                      }
                    }}
                  >
                    {t("settings:calendarFeeds.copy")}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(feed.id)}
                  >
                    {t("settings:calendarFeeds.revoke")}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("settings:calendarFeeds.timeZoneHint", {
                  timeZone: feed.timeZone,
                })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

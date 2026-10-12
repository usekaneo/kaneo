import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LockIcon, CalendarPlusIcon } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarFeedLabelPicker } from "@/components/project/calendar-feeds/calendar-feed-label-picker";
import {
  type CalendarLabelOption,
  getCalendarLabelOptions,
} from "@/components/project/calendar-feeds/get-calendar-label-options";
import { calendarFeedsQueryKey } from "@/components/project/calendar-feeds/use-calendar-feeds";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { createCalendarFeed } from "@/fetchers/calendar-feed";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { toast } from "@/lib/toast";

const MAX_FEED_LABELS = 100;

type NewCalendarFeedFormProps = {
  projectId: string;
  workspaceId: string;
  onClose: () => void;
};

export function NewCalendarFeedForm({
  projectId,
  workspaceId,
  onClose,
}: NewCalendarFeedFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const labelsQuery = useGetLabelsByWorkspace(workspaceId);
  const options = getCalendarLabelOptions(labelsQuery.data ?? []);
  const [selected, setSelected] = useState<CalendarLabelOption[]>([]);
  const pickerId = useId();
  const hintId = useId();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
        queryKey: ["labels", workspaceId],
      });
      await queryClient.invalidateQueries({
        queryKey: calendarFeedsQueryKey(projectId),
      });
      toast.success(t("settings:calendarFeeds.created"), {
        icon: CalendarPlusIcon,
      });
      onClose();
    },
    onError: () => toast.error(t("settings:calendarFeeds.createError")),
  });

  const createDisabled =
    selected.length > MAX_FEED_LABELS ||
    create.isPending ||
    (selected.length > 0 && labelsQuery.isError);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("settings:calendarFeeds.dialogTitle")}</DialogTitle>
        <DialogDescription>
          {t("settings:calendarFeeds.dialogDescription")}
        </DialogDescription>
      </DialogHeader>
      <DialogPanel className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor={pickerId}>{t("settings:calendarFeeds.labels")}</Label>
          <CalendarFeedLabelPicker
            id={pickerId}
            describedBy={hintId}
            options={options}
            value={selected}
            onValueChange={setSelected}
            disabled={
              create.isPending || labelsQuery.isLoading || labelsQuery.isError
            }
          />
          {labelsQuery.isError ? (
            <p role="alert" className="text-destructive-foreground text-xs">
              {t("settings:calendarFeeds.loadError")}
            </p>
          ) : null}
          <p id={hintId} className="text-muted-foreground text-xs">
            {t("settings:calendarFeeds.labelsHint")}
          </p>
        </div>
        <div className="flex items-start gap-2.5 rounded-lg border border-border px-3.5 py-3 text-muted-foreground text-xs">
          <LockIcon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>{t("settings:calendarFeeds.accessHint")}</span>
        </div>
      </DialogPanel>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("common:actions.cancel")}
        </Button>
        <Button
          type="button"
          disabled={createDisabled}
          onClick={() => create.mutate()}
        >
          {t(
            create.isPending
              ? "settings:calendarFeeds.creating"
              : "settings:calendarFeeds.create",
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

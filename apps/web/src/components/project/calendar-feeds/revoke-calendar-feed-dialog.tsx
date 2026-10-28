import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarXIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { calendarFeedsQueryKey } from "@/components/project/calendar-feeds/use-calendar-feeds";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { revokeCalendarFeed } from "@/fetchers/calendar-feed";
import { toast } from "@/lib/toast";

type RevokeCalendarFeedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  feedId: string | null;
};

export function RevokeCalendarFeedDialog({
  open,
  onOpenChange,
  projectId,
  feedId,
}: RevokeCalendarFeedDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const revoke = useMutation({
    mutationFn: (id: string) => revokeCalendarFeed(projectId, id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: calendarFeedsQueryKey(projectId),
      });
      toast.success(t("settings:calendarFeeds.revoked"), {
        icon: CalendarXIcon,
      });
      onOpenChange(false);
    },
    onError: () => toast.error(t("settings:calendarFeeds.revokeError")),
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (next || !revoke.isPending) onOpenChange(next);
      }}
      title={t("settings:calendarFeeds.revokeConfirmTitle")}
      description={t("settings:calendarFeeds.revokeConfirmDescription")}
      confirmLabel={t("settings:calendarFeeds.revokeConfirm")}
      pendingLabel={t("settings:calendarFeeds.revoking")}
      pending={revoke.isPending}
      onConfirm={() => {
        if (feedId) revoke.mutate(feedId);
      }}
    />
  );
}

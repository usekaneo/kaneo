import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createMeetingBooking,
  getMeetingBooking,
} from "@/fetchers/meeting/meeting-api";
import { toast } from "@/lib/toast";

type TaskMeetingPanelProps = {
  taskId: string;
  workspaceId: string;
  taskType?: string | null;
};

function isMeetingTaskType(taskType?: string | null) {
  if (!taskType) return false;
  const normalized = taskType.toLowerCase();
  return normalized === "reuniao" || normalized === "meeting";
}

export default function TaskMeetingPanel({
  taskId,
  workspaceId,
  taskType,
}: TaskMeetingPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [schedulingUrl, setSchedulingUrl] = useState("");

  const enabled = isMeetingTaskType(taskType);

  const { data: booking, isLoading } = useQuery({
    queryKey: ["meeting-booking", taskId],
    queryFn: () => getMeetingBooking(taskId),
    enabled: enabled && Boolean(taskId),
  });

  const createMutation = useMutation({
    mutationFn: createMeetingBooking,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["meeting-booking", taskId],
      });
      toast.success(t("meetings:panel.createdSuccess"));
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t("meetings:panel.createdError"),
      );
    },
  });

  if (!enabled) return null;

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{t("meetings:panel.title")}</h3>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("meetings:panel.loading")}
        </div>
      ) : booking?.schedulingUrl || booking?.meetingUrl ? (
        <div className="space-y-2 text-sm">
          {booking.schedulingUrl ? (
            <a
              href={booking.schedulingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {t("meetings:panel.schedulingLink")}
              <ExternalLink className="size-3" />
            </a>
          ) : null}
          {booking.meetingUrl ? (
            <a
              href={booking.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {t("meetings:panel.meetingLink")}
              <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("meetings:panel.empty")}
          </p>
          <div className="space-y-2">
            <Label htmlFor="scheduling-url">
              {t("meetings:panel.urlLabel")}
            </Label>
            <Input
              id="scheduling-url"
              value={schedulingUrl}
              onChange={(event) => setSchedulingUrl(event.target.value)}
              placeholder="https://cal.com/seu-time/reuniao"
            />
          </div>
          <Button
            size="sm"
            disabled={!schedulingUrl.trim() || createMutation.isPending}
            onClick={() =>
              createMutation.mutate({
                workspaceId,
                taskId,
                schedulingUrl: schedulingUrl.trim(),
              })
            }
          >
            {createMutation.isPending
              ? t("meetings:panel.creating")
              : t("meetings:panel.create")}
          </Button>
        </div>
      )}
    </div>
  );
}

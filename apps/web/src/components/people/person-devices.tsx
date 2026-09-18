import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRevokeDevice } from "@/hooks/mutations/agent/use-agent-mutations";
import { useDevices } from "@/hooks/queries/agent/use-agent";
import { formatRelativeTime } from "@/lib/format";
import { toast } from "@/lib/toast";

// Computers running the desktop app for this person. Admins can disconnect a
// lost or shared machine here; the person can do it from their own settings.
export function PersonDevices({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}) {
  const { t } = useTranslation();
  const { data: devices = [] } = useDevices(workspaceId, userId);
  const revoke = useRevokeDevice(workspaceId);
  const active = devices.filter((d) => !d.revokedAt);
  if (active.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{t("devices:list.title")}</h3>
      <ul className="divide-y divide-border rounded-md border border-border">
        {active.map((device) => (
          <li
            key={device.id}
            className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
          >
            <span className="min-w-0">
              <span className="font-medium">{device.name}</span>
              <span className="text-muted-foreground">
                {" · "}
                {device.platform}
                {device.lastSeenAt &&
                  ` · ${t("devices:list.lastSeen", {
                    time: formatRelativeTime(device.lastSeenAt),
                  })}`}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <Badge variant={device.online ? "success" : "outline"}>
                {device.online
                  ? device.lastState === "paused"
                    ? t("devices:list.paused")
                    : t("devices:list.online")
                  : t("devices:list.offline")}
              </Badge>
              <Button
                variant="outline"
                size="xs"
                disabled={revoke.isPending}
                onClick={() =>
                  revoke
                    .mutateAsync(device.id)
                    .then(() => toast.success(t("devices:list.revoked")))
                    .catch((e) =>
                      toast.error(
                        e instanceof Error ? e.message : t("devices:error"),
                      ),
                    )
                }
              >
                {t("devices:list.disconnect")}
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { resolveApiBaseUrl } from "@kaneo/libs";
import { createFileRoute } from "@tanstack/react-router";
import { Monitor } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  useCreatePairingCode,
  useRevokeDevice,
} from "@/hooks/mutations/agent/use-agent-mutations";
import { useDevices } from "@/hooks/queries/agent/use-agent";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { formatDateMedium, formatRelativeTime } from "@/lib/format";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/devices",
)({
  component: RouteComponent,
});

// The API address this page talks to. The desktop app needs the API, which
// is not always the address in the browser bar (separately hosted API, or the
// Vite dev server).
const serverAddress = new URL(
  resolveApiBaseUrl(import.meta.env.VITE_API_URL),
  window.location.origin,
).toString();

function RouteComponent() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id ?? "";
  const { data: devices = [] } = useDevices(workspaceId || undefined);
  const createCode = useCreatePairingCode(workspaceId);
  const revoke = useRevokeDevice(workspaceId);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(
    null,
  );

  const newCode = async () => {
    try {
      const created = await createCode.mutateAsync();
      setCode({ code: created.code, expiresAt: String(created.expiresAt) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("devices:error"));
    }
  };

  const active = devices.filter((d) => !d.revokedAt);

  return (
    <>
      <PageTitle title={t("devices:title")} />
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{t("devices:title")}</h1>
          <p className="text-muted-foreground">
            {t("devices:subtitle", { workspace: workspace?.name ?? "" })}
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-md font-medium">
              {t("devices:connect.title")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("devices:connect.subtitle")}
            </p>
          </div>
          <div className="space-y-3 rounded-md border border-border bg-sidebar p-4">
            {code ? (
              <div className="space-y-2">
                <p className="font-mono text-2xl tracking-[0.3em]">
                  {code.code}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("devices:connect.expires", {
                    time: formatRelativeTime(code.expiresAt),
                  })}
                </p>
                <ol className="list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
                  <li>{t("devices:connect.step1")}</li>
                  <li>
                    {t("devices:connect.step2", { address: serverAddress })}
                  </li>
                  <li>{t("devices:connect.step3")}</li>
                </ol>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("devices:connect.whatIsShared")}
              </p>
            )}
            <Button
              size="sm"
              variant={code ? "outline" : "default"}
              onClick={newCode}
              disabled={!workspaceId || createCode.isPending}
            >
              {code
                ? t("devices:connect.newCode")
                : t("devices:connect.button")}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-md font-medium">{t("devices:list.title")}</h2>
          {active.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia>
                  <Monitor className="size-8 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle>{t("devices:list.emptyTitle")}</EmptyTitle>
                <EmptyDescription>
                  {t("devices:list.emptyDescription")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {active.map((device) => (
                <li
                  key={device.id}
                  className="flex items-center justify-between gap-4 p-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{device.name}</span>
                      <Badge variant={device.online ? "success" : "outline"}>
                        {device.online
                          ? device.lastState === "paused"
                            ? t("devices:list.paused")
                            : t("devices:list.online")
                          : t("devices:list.offline")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {device.platform}
                      {device.agentVersion ? ` · v${device.agentVersion}` : ""}
                      {" · "}
                      {device.lastSeenAt
                        ? t("devices:list.lastSeen", {
                            time: formatRelativeTime(device.lastSeenAt),
                          })
                        : t("devices:list.added", {
                            date: formatDateMedium(device.createdAt),
                          })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

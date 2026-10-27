import { LogOutIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import type { ActiveSession } from "@/fetchers/user/session-types";
import useRevokeOtherSessions from "@/hooks/mutations/user/use-revoke-other-sessions";
import useRevokeUserSession from "@/hooks/mutations/user/use-revoke-user-session";
import useUserSessions from "@/hooks/queries/user/use-user-sessions";
import { toast } from "@/lib/toast";
import { RevokeSessionDialog } from "./revoke-session-dialog";
import { SessionRow } from "./session-row";

export function ActiveSessionsSettings() {
  const { t } = useTranslation();
  const { data, isPending, isError } = useUserSessions();
  const revokeSession = useRevokeUserSession();
  const revokeOthers = useRevokeOtherSessions();
  const [revoking, setRevoking] = useState<ActiveSession | null>(null);
  const [confirmOthers, setConfirmOthers] = useState(false);
  const sessions = data?.sessions ?? [];
  const hasOthers = sessions.some((session) => !session.current);

  const handleRevoke = async () => {
    if (!revoking) return;
    try {
      await revokeSession.mutateAsync(revoking.id);
      toast.success(t("settings:sessions.toastRevoked"), { icon: LogOutIcon });
      setRevoking(null);
    } catch {
      toast.error(t("settings:sessions.toastRevokeError"));
    }
  };

  const handleRevokeOthers = async () => {
    try {
      await revokeOthers.mutateAsync();
      toast.success(t("settings:securityPage.sessions.toastRevokedOthers"), {
        icon: LogOutIcon,
      });
      setConfirmOthers(false);
    } catch {
      toast.error(t("settings:sessions.toastRevokeError"));
    }
  };

  return (
    <SettingsSection
      title={t("settings:securityPage.sessions.title")}
      description={t("settings:securityPage.sessions.description")}
      action={
        hasOthers ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirmOthers(true)}
          >
            {t("settings:securityPage.sessions.revokeOthers")}
          </Button>
        ) : null
      }
    >
      <SettingsCard>
        {isPending ? (
          <SettingsRowsSkeleton rows={2} withDescription />
        ) : isError ? (
          <p
            role="alert"
            className="px-4 py-3.5 text-destructive-foreground text-sm"
          >
            {t("settings:sessions.loadError")}
          </p>
        ) : (
          sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              onRevoke={() => setRevoking(session)}
            />
          ))
        )}
      </SettingsCard>

      <RevokeSessionDialog
        session={revoking}
        pending={revokeSession.isPending}
        onConfirm={handleRevoke}
        onClose={() => setRevoking(null)}
      />
      <ConfirmDialog
        open={confirmOthers}
        onOpenChange={(open) => {
          if (open || !revokeOthers.isPending) setConfirmOthers(open);
        }}
        title={t("settings:securityPage.sessions.revokeOthersConfirmTitle")}
        description={t(
          "settings:securityPage.sessions.revokeOthersConfirmDescription",
        )}
        confirmLabel={t("settings:securityPage.sessions.revokeOthers")}
        pendingLabel={t("settings:sessions.revoking")}
        pending={revokeOthers.isPending}
        onConfirm={handleRevokeOthers}
      />
    </SettingsSection>
  );
}

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DirectoryErrorRow } from "@/components/admin/directory/directory-error-row";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { Button } from "@/components/ui/button";
import { deleteAdminWebhook } from "@/fetchers/admin/delete-admin-webhook";
import { rotateAdminWebhookSecret } from "@/fetchers/admin/rotate-admin-webhook-secret";
import { sendAdminWebhookTest } from "@/fetchers/admin/send-admin-webhook-test";
import type { AdminWebhook } from "@/fetchers/admin/webhook-types";
import useAdminWebhookMutation from "@/hooks/mutations/admin/use-admin-webhook-mutation";
import useAdminWebhooks from "@/hooks/queries/admin/use-admin-webhooks";
import { toast } from "@/lib/toast";
import { WebhookDialog } from "./webhook-dialog";
import { WebhookDeliveriesDialog } from "./webhook-deliveries-dialog";
import { WebhookRow } from "./webhook-row";
import { WebhookSecretDialog } from "./webhook-secret-dialog";

type Confirmation = { kind: "delete" | "rotate"; webhook: AdminWebhook };
export default function WebhooksPanel() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useAdminWebhooks();
  const [editing, setEditing] = useState<AdminWebhook | null | undefined>(
    undefined,
  );
  const [secret, setSecret] = useState<string | null>(null);
  const [history, setHistory] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const remove = useAdminWebhookMutation(deleteAdminWebhook);
  const rotate = useAdminWebhookMutation(rotateAdminWebhookSecret);
  const test = useAdminWebhookMutation(sendAdminWebhookTest);
  const pending = remove.isPending || rotate.isPending || test.isPending;
  const confirm = async () => {
    if (!confirmation) return;
    try {
      if (confirmation.kind === "delete")
        await remove.mutateAsync(confirmation.webhook.id);
      else {
        const result = await rotate.mutateAsync(confirmation.webhook.id);
        setSecret(result.secret);
        rotate.reset();
      }
      setConfirmation(null);
    } catch {
      return;
    }
  };
  const sendTest = async (id: string) => {
    try {
      await test.mutateAsync(id);
      toast.success(t("settings:adminWebhooks.testQueued"));
      setHistory(id);
    } catch {
      return;
    }
  };
  return (
    <SettingsPage
      title={t("settings:adminWebhooks.title")}
      actions={
        <Button
          type="button"
          size="sm"
          disabled={!data?.signingConfigured}
          onClick={() => setEditing(null)}
        >
          <PlusIcon aria-hidden="true" />
          {t("settings:adminWebhooks.add")}
        </Button>
      }
    >
      {data && !data.signingConfigured ? (
        <p className="text-sm text-muted-foreground">
          {t("settings:adminWebhooks.setup")}
        </p>
      ) : null}
      <SettingsCard>
        {isLoading ? <SettingsRowsSkeleton rows={3} /> : null}
        {isError ? (
          <DirectoryErrorRow
            message={t("settings:adminWebhooks.loadError")}
            retryLabel={t("settings:adminUsers.retry")}
            onRetry={() => refetch()}
          />
        ) : null}
        {data?.webhooks.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("settings:adminWebhooks.empty")}
          </p>
        ) : null}
        {data ? (
          <div
            role="list"
            aria-label={t("settings:adminWebhooks.title")}
            className="divide-y divide-border"
          >
            {data.webhooks.map((webhook) => (
              <WebhookRow
                key={webhook.id}
                webhook={webhook}
                signingConfigured={data.signingConfigured}
                pending={pending}
                onEdit={() => setEditing(webhook)}
                onDelete={() => setConfirmation({ kind: "delete", webhook })}
                onRotate={() => setConfirmation({ kind: "rotate", webhook })}
                onTest={() => {
                  void sendTest(webhook.id);
                }}
                onHistory={() => setHistory(webhook.id)}
              />
            ))}
          </div>
        ) : null}
      </SettingsCard>
      {editing !== undefined ? (
        <WebhookDialog
          webhook={editing}
          onClose={() => setEditing(undefined)}
          onSecret={setSecret}
        />
      ) : null}
      {secret ? (
        <WebhookSecretDialog secret={secret} onClose={() => setSecret(null)} />
      ) : null}
      {history ? (
        <WebhookDeliveriesDialog
          webhookId={history}
          onClose={() => setHistory(null)}
        />
      ) : null}
      <ConfirmDialog
        open={confirmation !== null}
        title={
          confirmation?.kind === "rotate"
            ? t("settings:adminWebhooks.rotateTitle")
            : t("settings:adminWebhooks.deleteTitle")
        }
        confirmLabel={
          confirmation?.kind === "rotate"
            ? t("settings:adminWebhooks.rotate")
            : t("common:actions.delete")
        }
        pending={remove.isPending || rotate.isPending}
        onConfirm={() => {
          void confirm();
        }}
        onOpenChange={(open) => {
          if (!open && !remove.isPending && !rotate.isPending)
            setConfirmation(null);
        }}
      />
    </SettingsPage>
  );
}

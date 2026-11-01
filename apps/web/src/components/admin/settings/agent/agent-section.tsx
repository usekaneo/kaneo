import { BotIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DirectoryErrorRow } from "@/components/admin/directory/directory-error-row";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import { SettingsNote } from "@/components/settings/settings-note";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { useUpdateAdminAgentSettings } from "@/hooks/mutations/admin/use-update-admin-agent-settings";
import { useAdminAgentSettings } from "@/hooks/queries/admin/use-admin-agent-settings";
import { AddModelDialog } from "./add-model-dialog";
import { AgentModelRow } from "./agent-model-row";
import { addModel, makeDefault, removeModel } from "./model-policy";

const MAX_MODELS = 20;

export function AgentSection() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useAdminAgentSettings();
  const update = useUpdateAdminAgentSettings();
  const [adding, setAdding] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const pending = update.isPending;
  const ids = data?.models.map((item) => item.id) ?? [];
  const full = ids.length >= MAX_MODELS;

  const actions = data ? (
    <div className="flex items-center gap-2">
      {data.managed ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setRestoring(true)}
        >
          {t("settings:adminAgent.restoreDefaults")}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || full || !data.providers.length}
        onClick={() => setAdding(true)}
      >
        <PlusIcon aria-hidden="true" />
        {t("settings:adminAgent.add")}
      </Button>
    </div>
  ) : undefined;

  return (
    <SettingsSection
      title={t("settings:adminAgent.title")}
      description={t("settings:adminAgent.description")}
      action={actions}
    >
      <SettingsCard>
        {isLoading ? <SettingsRowsSkeleton rows={3} /> : null}
        {isError ? (
          <DirectoryErrorRow
            message={t("settings:adminAgent.loadError")}
            retryLabel={t("settings:adminUsers.retry")}
            onRetry={() => refetch()}
          />
        ) : null}
        {data && !data.models.length ? (
          <SettingsEmpty
            icon={<BotIcon />}
            title={t("settings:adminAgent.emptyTitle")}
            description={t("settings:adminAgent.noModels")}
          />
        ) : null}
        {data?.models.map((model) => (
          <AgentModelRow
            key={model.id}
            model={model}
            isDefault={model.id === data.model}
            canRemove={data.models.length > 1}
            disabled={pending}
            onMakeDefault={() => update.mutate(makeDefault(data, model.id))}
            onRemove={() => {
              const policy = removeModel(data, model.id);
              if (policy) update.mutate(policy);
            }}
          />
        ))}
      </SettingsCard>
      {data && !data.enabled ? (
        <SettingsNote>{t("settings:adminAgent.unavailable")}</SettingsNote>
      ) : null}
      {data && !data.providers.length ? (
        <SettingsNote>{t("settings:adminAgent.noProviders")}</SettingsNote>
      ) : null}
      {full ? (
        <SettingsNote>{t("settings:adminAgent.limit")}</SettingsNote>
      ) : null}
      {data ? (
        <AddModelDialog
          open={adding}
          onOpenChange={setAdding}
          providers={data.providers}
          selectedIds={ids}
          pending={pending}
          onAdd={(model) =>
            update.mutate(addModel(data, model.id), {
              onSuccess: () => setAdding(false),
            })
          }
        />
      ) : null}
      <ConfirmDialog
        open={restoring}
        onOpenChange={setRestoring}
        title={t("settings:adminAgent.restoreTitle")}
        description={t("settings:adminAgent.restoreDescription")}
        confirmLabel={t("settings:adminAgent.restore")}
        pending={pending}
        destructive={false}
        onConfirm={() =>
          update.mutate(null, { onSuccess: () => setRestoring(false) })
        }
      />
    </SettingsSection>
  );
}

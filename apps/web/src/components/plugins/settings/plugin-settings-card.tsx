import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useUpdatePluginWorkspace } from "@/hooks/mutations/plugin/use-update-plugin-workspace";
import type { RuntimePlugin } from "@/lib/plugins/runtime/select-contributions";
import { PluginApiError } from "@/lib/plugins/plugin-api-error";
import { toast } from "@/lib/toast";
import type { InstalledPlugin } from "@/types/plugin";
import { PluginSettingsForm } from "./plugin-settings-form";
import { PluginSettingsPanel } from "./plugin-settings-panel";
import { PluginStatusBadge } from "./plugin-status-badge";

type PluginSettingsCardProps = {
  plugin: InstalledPlugin;
  runtime: RuntimePlugin | undefined;
  workspaceId: string;
  canEdit: boolean;
};

export function PluginSettingsCard({
  plugin,
  runtime,
  workspaceId,
  canEdit,
}: PluginSettingsCardProps) {
  const { t } = useTranslation();
  const { mutateAsync, isPending, variables } = useUpdatePluginWorkspace();
  const [enableErrors, setEnableErrors] = useState<Record<string, string>>({});
  const enabled =
    isPending && variables?.enabled !== undefined
      ? variables.enabled
      : plugin.workspace?.enabled === true;
  const headingId = `plugin-${plugin.id}-name`;
  const formKey = JSON.stringify([
    plugin.version,
    plugin.workspace?.settings ?? null,
    plugin.workspace?.configuredSecrets ?? null,
  ]);

  const handleEnabledChange = async (checked: boolean) => {
    setEnableErrors({});
    try {
      await mutateAsync({
        pluginId: plugin.id,
        workspaceId,
        enabled: checked,
      });
      toast.success(
        t(
          checked
            ? "settings:workspacePlugins.toast.enabled"
            : "settings:workspacePlugins.toast.disabled",
          { name: plugin.name },
        ),
      );
    } catch (error) {
      if (error instanceof PluginApiError) setEnableErrors(error.fieldErrors);
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspacePlugins.toast.updateError"),
      );
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4 rounded-md border border-border bg-sidebar p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={headingId} className="text-md font-medium">
              {plugin.name}
            </h2>
            <Badge variant="outline">{plugin.version}</Badge>
            {plugin.official ? (
              <Badge variant="info">
                {t("settings:workspacePlugins.builtIn")}
              </Badge>
            ) : null}
            {enabled && runtime ? (
              <PluginStatusBadge state={runtime.state} />
            ) : null}
          </div>
          {plugin.description ? (
            <p className="text-xs text-muted-foreground">
              {plugin.description}
            </p>
          ) : null}
          <p className="font-mono text-[11px] text-muted-foreground/80">
            {plugin.packageName}
          </p>
          {enabled && runtime?.state.status === "failed" ? (
            <p className="break-words text-xs text-destructive-foreground">
              {runtime.state.error.message}
            </p>
          ) : null}
        </div>
        <Switch
          checked={enabled}
          disabled={!canEdit || isPending}
          aria-label={t("settings:workspacePlugins.enable", {
            name: plugin.name,
          })}
          onCheckedChange={(checked) => void handleEnabledChange(checked)}
        />
      </div>

      {Object.keys(plugin.settings).length > 0 ? (
        <>
          <Separator />
          <PluginSettingsForm
            key={formKey}
            plugin={plugin}
            workspaceId={workspaceId}
            canEdit={canEdit}
            externalErrors={enableErrors}
            onSaved={() => setEnableErrors({})}
          />
        </>
      ) : null}

      {enabled && runtime ? (
        <PluginSettingsPanel runtime={runtime} workspaceId={workspaceId} />
      ) : null}
    </section>
  );
}

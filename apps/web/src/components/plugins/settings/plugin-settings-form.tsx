import { type FormEvent, Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useUpdatePluginWorkspace } from "@/hooks/mutations/plugin/use-update-plugin-workspace";
import { PluginApiError } from "@/lib/plugins/plugin-api-error";
import {
  hasSettingsChanges,
  type SettingFormValue,
  toFormValues,
  toSettingsPayload,
} from "@/lib/plugins/settings/settings-form-values";
import { toast } from "@/lib/toast";
import type { InstalledPlugin } from "@/types/plugin";
import { PluginSettingField } from "./plugin-setting-field";

type PluginSettingsFormProps = {
  plugin: InstalledPlugin;
  workspaceId: string;
  canEdit: boolean;
  externalErrors: Record<string, string>;
  onSaved: () => void;
};

export function PluginSettingsForm({
  plugin,
  workspaceId,
  canEdit,
  externalErrors,
  onSaved,
}: PluginSettingsFormProps) {
  const { t } = useTranslation();
  const { mutateAsync, isPending } = useUpdatePluginWorkspace();
  const configuredSecrets = plugin.workspace?.configuredSecrets ?? [];
  const initial = useMemo(
    () =>
      toFormValues(
        plugin.settings,
        plugin.workspace?.settings ?? {},
        plugin.workspace?.configuredSecrets ?? [],
      ),
    [plugin.settings, plugin.workspace],
  );
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isDirty = hasSettingsChanges(plugin.settings, initial, values);

  const handleChange = (key: string, value: SettingFormValue) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors(({ [key]: _removed, ...rest }) => rest);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await mutateAsync({
        pluginId: plugin.id,
        workspaceId,
        settings: toSettingsPayload(plugin.settings, values),
      });
      setErrors({});
      onSaved();
      toast.success(t("settings:workspacePlugins.toast.saved"));
    } catch (error) {
      if (
        error instanceof PluginApiError &&
        Object.keys(error.fieldErrors).length > 0
      ) {
        setErrors(error.fieldErrors);
        toast.error(t("settings:workspacePlugins.toast.invalid"));
        return;
      }
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:workspacePlugins.toast.updateError"),
      );
    }
  };

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit}>
      {Object.entries(plugin.settings).map(([key, field], index) => (
        <Fragment key={key}>
          {index > 0 ? <Separator /> : null}
          <PluginSettingField
            field={field}
            value={values[key]}
            configured={configuredSecrets.includes(key)}
            error={errors[key] ?? externalErrors[key]}
            disabled={!canEdit || isPending}
            onChange={(value) => handleChange(key, value)}
          />
        </Fragment>
      ))}
      {errors._ ? (
        <p role="alert" className="text-xs text-destructive-foreground">
          {errors._}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={!canEdit || !isDirty}
          loading={isPending}
        >
          {t("settings:workspacePlugins.form.save")}
        </Button>
      </div>
    </form>
  );
}

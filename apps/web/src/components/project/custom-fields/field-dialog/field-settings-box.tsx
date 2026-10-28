import { useTranslation } from "react-i18next";
import { FieldDefaultInput } from "@/components/project/custom-fields/field-dialog/field-default-input";
import type { FieldFormState } from "@/components/project/custom-fields/field-dialog/field-form";
import { FieldSettingRow } from "@/components/project/custom-fields/field-dialog/field-setting-row";
import { Switch } from "@/components/ui/switch";

type FieldSettingsBoxProps = {
  form: FieldFormState;
  onMultipleChange: (multiple: boolean) => void;
  onRequiredChange: (required: boolean) => void;
  onDefaultChange: (
    defaults: Pick<FieldFormState, "defaultValue" | "defaultValues">,
  ) => void;
};

export function FieldSettingsBox({
  form,
  onMultipleChange,
  onRequiredChange,
  onDefaultChange,
}: FieldSettingsBoxProps) {
  const { t } = useTranslation();

  return (
    <div className="divide-y divide-border rounded-lg border">
      {form.kind === "dropdown" ? (
        <FieldSettingRow
          title={t("settings:customFields.allowSeveral")}
          description={t("settings:customFields.allowSeveralDescription")}
        >
          {({ labelId, descriptionId }) => (
            <Switch
              checked={form.multiple}
              onCheckedChange={onMultipleChange}
              aria-labelledby={labelId}
              aria-describedby={descriptionId}
            />
          )}
        </FieldSettingRow>
      ) : null}
      <FieldSettingRow
        title={t("settings:customFields.required")}
        description={t("settings:customFields.requiredDescription")}
      >
        {({ labelId, descriptionId }) => (
          <Switch
            checked={form.required}
            onCheckedChange={onRequiredChange}
            aria-labelledby={labelId}
            aria-describedby={descriptionId}
          />
        )}
      </FieldSettingRow>
      <FieldSettingRow
        title={t("settings:customFields.defaultLabel")}
        description={t("settings:customFields.defaultDescription")}
      >
        {({ labelId }) => (
          <FieldDefaultInput
            form={form}
            labelledBy={labelId}
            onChange={onDefaultChange}
          />
        )}
      </FieldSettingRow>
    </div>
  );
}

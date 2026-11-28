import type { SettingField } from "@kaneo/plugin-sdk";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Fieldset, FieldsetLegend } from "@/components/ui/fieldset";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  isSecretFormValue,
  type SettingFormValue,
} from "@/lib/plugins/settings/settings-form-values";
import { SecretSettingField } from "./secret-setting-field";

type PluginSettingFieldProps = {
  field: SettingField;
  value: SettingFormValue | undefined;
  configured: boolean;
  error: string | undefined;
  disabled: boolean;
  onChange: (value: SettingFormValue) => void;
};

export function PluginSettingField({
  field,
  value,
  configured,
  error,
  disabled,
  onChange,
}: PluginSettingFieldProps) {
  const { t } = useTranslation();
  const required = "required" in field && field.required === true;
  const text = typeof value === "string" ? value : "";

  if (field.type === "secret") {
    return (
      <SecretSettingField
        field={field}
        value={isSecretFormValue(value) ? value : { mode: "keep" }}
        configured={configured}
        error={error}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  if (field.type === "multiselect") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <Fieldset className="max-w-none gap-2">
        <FieldsetLegend className="font-medium text-sm">
          {field.label}
        </FieldsetLegend>
        {field.description ? (
          <p className="text-xs text-muted-foreground">{field.description}</p>
        ) : null}
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {field.options.map((option) => (
            <Label key={option.value} className="font-normal">
              <Checkbox
                checked={selected.includes(option.value)}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  onChange(
                    checked
                      ? [...selected, option.value]
                      : selected.filter((item) => item !== option.value),
                  )
                }
              />
              {option.label}
            </Label>
          ))}
        </div>
        {error ? (
          <p role="alert" className="text-xs text-destructive-foreground">
            {error}
          </p>
        ) : null}
      </Fieldset>
    );
  }

  if (field.type === "boolean") {
    return (
      <Field
        invalid={Boolean(error)}
        className="w-full flex-row items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <FieldLabel>{field.label}</FieldLabel>
          {field.description ? (
            <FieldDescription>{field.description}</FieldDescription>
          ) : null}
          {error ? <FieldError match>{error}</FieldError> : null}
        </div>
        <Switch
          checked={value === true}
          disabled={disabled}
          onCheckedChange={(checked) => onChange(checked)}
        />
      </Field>
    );
  }

  return (
    <Field invalid={Boolean(error)} className="w-full">
      <FieldLabel>
        {field.label}
        {required ? <span className="text-destructive">*</span> : null}
      </FieldLabel>
      {field.description ? (
        <FieldDescription>{field.description}</FieldDescription>
      ) : null}

      {field.type === "select" ? (
        <Select
          items={[
            ...(required
              ? []
              : [
                  {
                    value: null,
                    label: t("settings:workspacePlugins.form.none"),
                  },
                ]),
            ...field.options,
          ]}
          value={text === "" ? null : text}
          disabled={disabled}
          onValueChange={(next) =>
            onChange(typeof next === "string" ? next : "")
          }
        >
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue
              placeholder={t(
                "settings:workspacePlugins.form.selectPlaceholder",
              )}
            />
          </SelectTrigger>
          <SelectContent>
            {required ? null : (
              <SelectItem value={null}>
                {t("settings:workspacePlugins.form.none")}
              </SelectItem>
            )}
            {field.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "number" ? (
        <Input
          type="number"
          className="w-full sm:w-64"
          value={text}
          min={field.min}
          max={field.max}
          step={field.step}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.multiline ? (
        <Textarea
          value={text}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          value={text}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {error ? <FieldError match>{error}</FieldError> : null}
    </Field>
  );
}

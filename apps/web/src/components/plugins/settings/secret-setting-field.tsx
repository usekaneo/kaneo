import type { SecretSetting } from "@kaneo/plugin-sdk";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { SecretFormValue } from "@/lib/plugins/settings/settings-form-values";

type SecretSettingFieldProps = {
  field: SecretSetting;
  value: SecretFormValue;
  configured: boolean;
  error: string | undefined;
  disabled: boolean;
  onChange: (value: SecretFormValue) => void;
};

export function SecretSettingField({
  field,
  value,
  configured,
  error,
  disabled,
  onChange,
}: SecretSettingFieldProps) {
  const { t } = useTranslation();

  return (
    <Field invalid={Boolean(error)} className="w-full">
      <FieldLabel>
        {field.label}
        {field.required ? <span className="text-destructive">*</span> : null}
      </FieldLabel>
      {field.description ? (
        <FieldDescription>{field.description}</FieldDescription>
      ) : null}

      {value.mode === "replace" ? (
        <div className="flex w-full items-center gap-2">
          <Input
            type="password"
            autoComplete="new-password"
            value={value.value}
            placeholder={
              field.placeholder ??
              t("settings:workspacePlugins.form.secretPlaceholder")
            }
            disabled={disabled}
            onChange={(event) =>
              onChange({ mode: "replace", value: event.target.value })
            }
          />
          {configured ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onChange({ mode: "keep" })}
            >
              {t("settings:workspacePlugins.form.secretCancel")}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex w-full flex-wrap items-center gap-2">
          {value.mode === "keep" ? (
            <Badge variant="success">
              {t("settings:workspacePlugins.form.secretConfigured")}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t("settings:workspacePlugins.form.secretWillClear")}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {value.mode === "keep" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onChange({ mode: "replace", value: "" })}
                >
                  {t("settings:workspacePlugins.form.secretReplace")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onChange({ mode: "clear" })}
                >
                  {t("settings:workspacePlugins.form.secretClear")}
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => onChange({ mode: "keep" })}
              >
                {t("settings:workspacePlugins.form.secretUndo")}
              </Button>
            )}
          </div>
        </div>
      )}

      {error ? <FieldError match>{error}</FieldError> : null}
    </Field>
  );
}

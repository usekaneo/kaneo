import { useId } from "react";
import { useTranslation } from "react-i18next";
import {
  WORKSPACE_USAGE_OPTIONS,
  type WorkspaceUsage,
} from "@/constants/onboarding";
import { cn } from "@/lib/cn";

type UsagePickerProps = {
  value: WorkspaceUsage;
  onChange: (value: WorkspaceUsage) => void;
};

export function UsagePicker({ value, onChange }: UsagePickerProps) {
  const { t } = useTranslation();
  const name = useId();

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">
        {t("auth:onboarding.cloud.usageLabel")}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {WORKSPACE_USAGE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={cn(
              "cursor-pointer rounded-md border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              value === option.value
                ? "border-primary/60 bg-primary/5"
                : "border-border hover:bg-muted/50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="block text-sm font-medium">
              {t(option.labelKey)}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t(option.hintKey)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import { AUTOMATION_MAX_DAILY_RUNS } from "./automation-draft";
import { AutomationFieldError } from "./automation-field-error";

type AutomationDailyLimitFieldProps = {
  value: number;
  onValueChange: (value: number) => void;
  error: string | undefined;
};

export function AutomationDailyLimitField({
  value,
  onValueChange,
  error,
}: AutomationDailyLimitFieldProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor="automation-daily-limit">
        {t("agent:automations.form.dailyLimit")}
      </Label>
      <div className="flex flex-col items-end gap-1">
        <NumberField
          id="automation-daily-limit"
          size="sm"
          className="w-28"
          min={1}
          max={AUTOMATION_MAX_DAILY_RUNS}
          step={1}
          value={Number.isNaN(value) ? null : value}
          onValueChange={(next) => onValueChange(next ?? Number.NaN)}
        >
          <NumberFieldGroup aria-invalid={Boolean(error) || undefined}>
            <NumberFieldDecrement />
            <NumberFieldInput
              aria-describedby={
                error ? "automation-daily-limit-error" : undefined
              }
            />
            <NumberFieldIncrement />
          </NumberFieldGroup>
        </NumberField>
        <AutomationFieldError id="automation-daily-limit-error" error={error} />
      </div>
    </div>
  );
}

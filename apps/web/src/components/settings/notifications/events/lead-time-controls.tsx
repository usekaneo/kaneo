import { useTranslation } from "react-i18next";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getLeadTimeMax, type LeadTime, type LeadTimeUnit } from "./lead-time";

const UNIT_LABEL_KEYS: Record<LeadTimeUnit, string> = {
  hours: "settings:notificationsPage.reminderLeadTimeUnitHoursBefore",
  days: "settings:notificationsPage.reminderLeadTimeUnitDaysBefore",
};

type LeadTimeControlsProps = {
  disabled: boolean;
  invalid: boolean;
  leadTime: LeadTime;
  onChange: (leadTime: LeadTime) => void;
};

export function LeadTimeControls({
  disabled,
  invalid,
  leadTime,
  onChange,
}: LeadTimeControlsProps) {
  const { t } = useTranslation();
  const count = leadTime.amount ?? 0;

  return (
    <>
      <NumberField
        className="w-28"
        disabled={disabled}
        id="due-date-reminder-lead-time"
        max={getLeadTimeMax(leadTime.unit)}
        min={1}
        onValueChange={(value) => onChange({ ...leadTime, amount: value })}
        size="sm"
        step={1}
        value={leadTime.amount}
      >
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput
            aria-invalid={invalid || undefined}
            aria-label={t("settings:notificationsPage.reminderLeadTimeLabel")}
          />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
      <Select
        disabled={disabled}
        onValueChange={(unit) =>
          onChange({ ...leadTime, unit: unit === "hours" ? "hours" : "days" })
        }
        value={leadTime.unit}
      >
        <SelectTrigger
          aria-label={t("settings:notificationsPage.reminderLeadTimeUnitLabel")}
          className="w-36"
          size="sm"
        >
          <SelectValue>
            {t(UNIT_LABEL_KEYS[leadTime.unit], { count })}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="hours">
            {t(UNIT_LABEL_KEYS.hours, { count })}
          </SelectItem>
          <SelectItem value="days">
            {t(UNIT_LABEL_KEYS.days, { count })}
          </SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

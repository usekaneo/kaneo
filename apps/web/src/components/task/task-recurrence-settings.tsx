import { useTranslation } from "react-i18next";
import {
  NumberField,
  NumberFieldGroup,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskRecurrence } from "@/types/task/recurrence";
import WeekdayPicker from "./weekday-picker";

type Frequency = TaskRecurrence["frequency"];
type Pattern = Frequency | "periodically";

const PATTERNS: Pattern[] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "periodically",
];
const FREQUENCIES: Frequency[] = ["daily", "weekly", "monthly", "yearly"];

// Weekdays only belong to weekly rules. Until the user picks some, a weekly
// rule repeats on the due date's weekday.
function withFrequency(
  recurrence: TaskRecurrence,
  frequency: Frequency,
  interval: number,
): TaskRecurrence {
  const { weekdays: _, ...rule } = recurrence;
  return frequency === "weekly"
    ? { ...recurrence, frequency, interval }
    : { ...rule, frequency, interval };
}

export default function TaskRecurrenceSettings({
  recurrence,
  defaultWeekday,
  onChange,
}: {
  recurrence: TaskRecurrence;
  defaultWeekday?: number;
  onChange: (recurrence: TaskRecurrence) => void;
}) {
  const { t } = useTranslation();
  const pattern: Pattern =
    recurrence.interval > 1 ? "periodically" : recurrence.frequency;
  const patternLabels: Record<Pattern, string> = {
    daily: t("tasks:popover.recurrence.pattern.daily"),
    weekly: t("tasks:popover.recurrence.pattern.weekly"),
    monthly: t("tasks:popover.recurrence.pattern.monthly"),
    yearly: t("tasks:popover.recurrence.pattern.yearly"),
    periodically: t("tasks:popover.recurrence.pattern.periodically"),
  };
  const unitLabel = (frequency: Frequency) => {
    const count = recurrence.interval;
    switch (frequency) {
      case "daily":
        return t("tasks:popover.recurrence.unit.days", { count });
      case "weekly":
        return t("tasks:popover.recurrence.unit.weeks", { count });
      case "monthly":
        return t("tasks:popover.recurrence.unit.months", { count });
      case "yearly":
        return t("tasks:popover.recurrence.unit.years", { count });
    }
  };

  const change = (frequency: Frequency, interval: number) =>
    onChange(withFrequency(recurrence, frequency, interval));

  return (
    <div className="flex flex-col gap-3 border-t border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {t("tasks:popover.recurrence.repeats")}
        </span>
        <Select
          value={pattern}
          onValueChange={(value) => {
            if (value === "periodically")
              change(recurrence.frequency, Math.max(2, recurrence.interval));
            else if (value) change(value as Frequency, 1);
          }}
        >
          <SelectTrigger
            size="sm"
            className="w-36 min-w-0"
            aria-label={t("tasks:popover.recurrence.repeats")}
          >
            <SelectValue>{patternLabels[pattern]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PATTERNS.map((option) => (
              <SelectItem key={option} value={option}>
                {patternLabels[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {pattern === "periodically" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t("tasks:popover.recurrence.every")}
          </span>
          <NumberField
            key={recurrence.interval}
            size="sm"
            className="w-16"
            min={2}
            max={99}
            step={1}
            defaultValue={recurrence.interval}
            onValueCommitted={(value) => {
              if (value && value !== recurrence.interval)
                change(recurrence.frequency, value);
            }}
          >
            <NumberFieldGroup>
              <NumberFieldInput
                aria-label={t("tasks:popover.recurrence.interval")}
              />
            </NumberFieldGroup>
          </NumberField>
          <Select
            value={recurrence.frequency}
            onValueChange={(value) => {
              if (value) change(value as Frequency, recurrence.interval);
            }}
          >
            <SelectTrigger
              size="sm"
              className="min-w-0 flex-1"
              aria-label={t("tasks:popover.recurrence.unit.label")}
            >
              <SelectValue>{unitLabel(recurrence.frequency)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((frequency) => (
                <SelectItem key={frequency} value={frequency}>
                  {unitLabel(frequency)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {recurrence.frequency === "weekly" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">
            {t("tasks:popover.recurrence.onDays")}
          </span>
          {/* An undated rule without weekdays follows the completion day, so no
              day is shown as selected until the user picks one. */}
          <WeekdayPicker
            value={
              recurrence.weekdays ??
              (defaultWeekday === undefined ? [] : [defaultWeekday])
            }
            onChange={(weekdays) => onChange({ ...recurrence, weekdays })}
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t("tasks:popover.recurrence.hint")}
      </p>
    </div>
  );
}

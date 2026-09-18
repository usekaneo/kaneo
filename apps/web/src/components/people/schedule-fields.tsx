import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import { weekdayName } from "@/lib/schedule-format";

export type ScheduleValue = {
  workDays: number[];
  workStart: string;
  workEnd: string;
  breakMinutes: number;
};

type Props = {
  value: ScheduleValue;
  onChange: (value: ScheduleValue) => void;
  disabled?: boolean;
};

const WEEK = [1, 2, 3, 4, 5, 6, 7];

// Work days, hours and break: used for the company schedule and for a
// person's override.
export function ScheduleFields({ value, onChange, disabled }: Props) {
  const { t, i18n } = useTranslation();
  const id = useId();

  const toggleDay = (day: number, on: boolean) => {
    const next = on
      ? [...value.workDays, day]
      : value.workDays.filter((d) => d !== day);
    onChange({ ...value, workDays: [...new Set(next)].sort((a, b) => a - b) });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("people:schedule.workDays")}
        </Label>
        <div className="flex flex-wrap gap-1">
          {WEEK.map((day) => (
            <Toggle
              key={day}
              size="sm"
              variant="outline"
              disabled={disabled}
              pressed={value.workDays.includes(day)}
              onPressedChange={(on) => toggleDay(day, on)}
              aria-label={weekdayName(day, i18n.language, "short")}
              className="w-11 data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground"
            >
              {weekdayName(day, i18n.language, "short")}
            </Toggle>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label
            htmlFor={`${id}-start`}
            className="text-xs text-muted-foreground"
          >
            {t("people:schedule.start")}
          </Label>
          <Input
            id={`${id}-start`}
            type="time"
            disabled={disabled}
            value={value.workStart}
            onChange={(e) => onChange({ ...value, workStart: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label
            htmlFor={`${id}-end`}
            className="text-xs text-muted-foreground"
          >
            {t("people:schedule.end")}
          </Label>
          <Input
            id={`${id}-end`}
            type="time"
            disabled={disabled}
            value={value.workEnd}
            onChange={(e) => onChange({ ...value, workEnd: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label
            htmlFor={`${id}-break`}
            className="text-xs text-muted-foreground"
          >
            {t("people:schedule.breakMinutes")}
          </Label>
          <Input
            id={`${id}-break`}
            type="number"
            min={0}
            max={240}
            disabled={disabled}
            value={value.breakMinutes}
            onChange={(e) =>
              onChange({ ...value, breakMinutes: Number(e.target.value) || 0 })
            }
          />
        </div>
      </div>
    </div>
  );
}

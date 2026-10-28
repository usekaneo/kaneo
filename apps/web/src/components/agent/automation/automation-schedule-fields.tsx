import { useTranslation } from "react-i18next";
import WeekdayPicker from "@/components/task/weekday-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AutomationDraft, AutomationFrequency } from "./automation-draft";
import { AutomationFieldError } from "./automation-field-error";
import { AutomationTimezoneSelect } from "./automation-timezone-select";
import { isoToJsWeekday, jsToIsoWeekday } from "./describe-automation-trigger";
import type { AutomationDraftErrors } from "./validate-automation-draft";

const FREQUENCIES: AutomationFrequency[] = ["daily", "weekly", "interval"];
const HOURS = Array.from({ length: 24 }, (_, index) => index + 1);

type AutomationScheduleFieldsProps = {
  draft: AutomationDraft;
  onChange: (patch: Partial<AutomationDraft>) => void;
  errors: AutomationDraftErrors;
};

export function AutomationScheduleFields({
  draft,
  onChange,
  errors,
}: AutomationScheduleFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={draft.frequency}
        onValueChange={(value) => {
          if (value) onChange({ frequency: value as AutomationFrequency });
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label={t("agent:automations.form.frequency")}
        >
          <SelectValue>
            {t(`agent:automations.form.frequencies.${draft.frequency}`)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {FREQUENCIES.map((frequency) => (
            <SelectItem key={frequency} value={frequency}>
              {t(`agent:automations.form.frequencies.${frequency}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {draft.frequency === "weekly" && (
        <>
          <WeekdayPicker
            value={draft.weekdays.map(isoToJsWeekday)}
            onChange={(days) =>
              onChange({
                weekdays: days.map(jsToIsoWeekday).sort((a, b) => a - b),
              })
            }
          />
          <AutomationFieldError
            id="automation-weekdays-error"
            error={errors.weekdays}
          />
        </>
      )}

      {draft.frequency === "interval" ? (
        <>
          <Select
            value={String(draft.intervalHours)}
            onValueChange={(value) => {
              if (value) onChange({ intervalHours: Number(value) });
            }}
          >
            <SelectTrigger
              size="sm"
              aria-label={t("agent:automations.form.interval")}
            >
              <SelectValue>
                {t("agent:automations.trigger.everyHours", {
                  count: draft.intervalHours,
                })}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((hours) => (
                <SelectItem key={hours} value={String(hours)}>
                  {t("agent:automations.trigger.everyHours", { count: hours })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AutomationFieldError
            id="automation-interval-error"
            error={errors.intervalHours}
          />
        </>
      ) : (
        <>
          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
            <Input
              type="time"
              size="sm"
              required
              value={draft.time}
              aria-label={t("agent:automations.form.time")}
              aria-invalid={Boolean(errors.time)}
              onChange={(event) => onChange({ time: event.target.value })}
              className="font-mono"
            />
            <AutomationTimezoneSelect
              value={draft.timezone}
              onValueChange={(timezone) => onChange({ timezone })}
            />
          </div>
          <AutomationFieldError
            id="automation-time-error"
            error={errors.time}
          />
        </>
      )}
    </div>
  );
}

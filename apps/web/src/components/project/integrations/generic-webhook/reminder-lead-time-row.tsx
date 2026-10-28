import type { Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  type GenericWebhookFormValues,
  MAX_LEAD_TIME_HOURS,
  MIN_LEAD_TIME_HOURS,
} from "./generic-webhook-form-values";

type ReminderLeadTimeRowProps = {
  control: Control<GenericWebhookFormValues>;
};

export function ReminderLeadTimeRow({ control }: ReminderLeadTimeRowProps) {
  const { t } = useTranslation();

  return (
    <FormField
      control={control}
      name="dueDateReminderLeadTimeHours"
      render={({ field }) => (
        <FormItem className="space-y-1.5 ps-6.5">
          <div className="flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
            <span>
              {t("settings:genericWebhookIntegration.reminderLeadTimeBefore")}
            </span>
            <FormControl>
              <Input
                aria-label={t(
                  "settings:genericWebhookIntegration.reminderLeadTimeLabel",
                )}
                className="w-16"
                max={MAX_LEAD_TIME_HOURS}
                min={MIN_LEAD_TIME_HOURS}
                name={field.name}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(Number(event.target.value))}
                ref={field.ref}
                size="sm"
                step="any"
                type="number"
                value={field.value}
              />
            </FormControl>
            <span>
              {t("settings:genericWebhookIntegration.reminderLeadTimeAfter")}
            </span>
          </div>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}

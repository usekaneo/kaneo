import { useTranslation } from "react-i18next";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatWeekday } from "@/lib/format-recurrence";
import { useUserPreferencesStore } from "@/store/user-preferences";

export default function WeekdayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (weekdays: number[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const days = Array.from(
    { length: 7 },
    (_, index) => (weekStartsOn + index) % 7,
  );

  return (
    <ToggleGroup
      multiple
      variant="outline"
      size="sm"
      aria-label={t("tasks:popover.recurrence.onDays")}
      className="w-full justify-between"
      value={value.map(String)}
      onValueChange={(selected) => {
        // A weekly rule needs at least one day.
        if (selected.length > 0)
          onChange(selected.map(Number).sort((a, b) => a - b));
      }}
    >
      {days.map((day) => (
        <ToggleGroupItem
          key={day}
          value={String(day)}
          aria-label={formatWeekday(day, i18n.language)}
          className="flex-1 text-xs data-pressed:bg-primary data-pressed:text-primary-foreground dark:data-pressed:bg-primary"
        >
          {formatWeekday(day, i18n.language, "narrow")}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

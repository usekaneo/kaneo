import { useTranslation } from "react-i18next";
import type { CalendarLabelOption } from "@/components/project/calendar-feeds/get-calendar-label-options";
import { LabelDot } from "@/components/settings/labels/label-dot";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxValue,
} from "@/components/ui/combobox";

type CalendarFeedLabelPickerProps = {
  id: string;
  options: CalendarLabelOption[];
  value: CalendarLabelOption[];
  onValueChange: (value: CalendarLabelOption[]) => void;
  disabled: boolean;
  describedBy?: string;
};

export function CalendarFeedLabelPicker({
  id,
  options,
  value,
  onValueChange,
  disabled,
  describedBy,
}: CalendarFeedLabelPickerProps) {
  const { t } = useTranslation();

  return (
    <Combobox
      items={options}
      multiple
      value={value}
      onValueChange={onValueChange}
      isItemEqualToValue={(item, selected) => item.value === selected.value}
      disabled={disabled}
    >
      <ComboboxChips>
        <ComboboxValue>
          {(selected: CalendarLabelOption[]) => (
            <>
              {selected.map((item) => (
                <ComboboxChip aria-label={item.label} key={item.value}>
                  <LabelDot color={item.color} className="me-1.5" />
                  {item.label}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                aria-describedby={describedBy}
                placeholder={t("settings:calendarFeeds.selectLabels")}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxPopup>
        <ComboboxEmpty>{t("settings:calendarFeeds.noLabels")}</ComboboxEmpty>
        <ComboboxList>
          {(item: CalendarLabelOption) => (
            <ComboboxItem key={item.value} value={item}>
              <span className="flex min-w-0 items-center gap-2">
                <LabelDot color={item.color} />
                <span className="truncate">{item.label}</span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}

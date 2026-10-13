import { isAfter, isBefore, isSameDay, startOfDay } from "date-fns";
import { Calendar, CalendarDays, X } from "lucide-react";
import { useState } from "react";
import type { Matcher } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import type { OptionMenuItem } from "@/components/common/option-menu/option-menu-item";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { DateLimitHint } from "./date-limit-hint";
import { DatePickerMonthView } from "./date-picker-month-view";
import { parseDateQuery } from "./parse-date-query";
import { formatPickerDay, QUICK_DATE_LABEL_KEYS } from "./quick-date-labels";
import { getQuickDates } from "./quick-dates";

type DateBounds = { before?: Date; after?: Date };

type DatePickerMenuProps = {
  label: string;
  placeholder: string;
  clearLabel: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  bounds?: DateBounds;
  formatLimit?: (date: string) => string;
  canClear?: boolean;
};

const PICK = "pick";
const CLEAR = "clear";
const TYPED = "typed";

function isAllowed(date: Date, bounds?: DateBounds) {
  const day = startOfDay(date);
  if (bounds?.before && isBefore(day, startOfDay(bounds.before))) return false;
  if (bounds?.after && isAfter(day, startOfDay(bounds.after))) return false;
  return true;
}

export function DatePickerMenu({
  label,
  placeholder,
  clearLabel,
  value,
  onChange,
  bounds,
  formatLimit,
  canClear = value !== null,
}: DatePickerMenuProps) {
  const { t } = useTranslation();
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const [view, setView] = useState<"menu" | "month">("menu");
  const [query, setQuery] = useState("");
  const now = new Date();

  const quickDates = getQuickDates(now, weekStartsOn).filter((item) =>
    isAllowed(item.date, bounds),
  );
  const typed = parseDateQuery(query, now, weekStartsOn);
  const typedDate = typed && isAllowed(typed, bounds) ? typed : null;

  const options: OptionMenuItem[] = [
    ...(typedDate
      ? [
          {
            value: TYPED,
            label: formatPickerDay(typedDate),
            icon: <Calendar />,
            pinned: true,
          },
        ]
      : []),
    ...quickDates.map((item) => ({
      value: item.id,
      label: t(QUICK_DATE_LABEL_KEYS[item.id]),
      hint: formatPickerDay(item.date),
      icon: <Calendar />,
      selected: value ? isSameDay(value, item.date) : false,
    })),
    {
      value: PICK,
      label: t("tasks:datePicker.pickDate"),
      icon: <CalendarDays />,
    },
    ...(canClear ? [{ value: CLEAR, label: clearLabel, icon: <X /> }] : []),
  ];

  const limit = bounds?.before ?? bounds?.after;
  const limitHint =
    limit && formatLimit ? formatLimit(formatPickerDay(limit)) : null;

  const disabledDays: Matcher[] = [];
  if (bounds?.before) disabledDays.push({ before: bounds.before });
  if (bounds?.after) disabledDays.push({ after: bounds.after });

  const select = (selected: string) => {
    if (selected === PICK) {
      setView("month");
      return;
    }
    if (selected === CLEAR) {
      onChange(null);
      return;
    }
    if (selected === TYPED) {
      if (typedDate) onChange(typedDate);
      return;
    }
    const quick = quickDates.find((item) => item.id === selected);
    if (quick) onChange(quick.date);
  };

  if (view === "month") {
    return (
      <DatePickerMonthView
        placeholder={placeholder}
        value={value}
        valueLabel={value ? formatPickerDay(value) : null}
        disabled={disabledDays}
        limit={limit}
        limitHint={limitHint}
        onBack={() => setView("menu")}
        onSelect={onChange}
      />
    );
  }

  return (
    <>
      <OptionMenu
        label={label}
        placeholder={placeholder}
        options={options}
        onSelect={select}
        onQueryChange={setQuery}
        inputHint={value ? formatPickerDay(value) : undefined}
      />
      {limitHint && <DateLimitHint>{limitHint}</DateLimitHint>}
    </>
  );
}

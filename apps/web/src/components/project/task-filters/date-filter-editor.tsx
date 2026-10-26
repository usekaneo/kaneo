import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { MonthGrid } from "@/components/common/date-picker/month-grid";
import { formatDateMedium } from "@/lib/format";
import {
  parseDateCondition,
  serializeDateCondition,
  type DateCondition,
} from "@/lib/task-filters/date-condition";

export function DateFilterEditor({
  selected,
  onApply,
}: {
  selected: string[];
  onApply: (value: string) => void;
}) {
  const { t } = useTranslation();
  const initial = selected.map(parseDateCondition).find(Boolean);
  const [operator, setOperator] = useState<DateCondition["operator"]>(
    initial?.operator ?? "exact",
  );
  const [date, setDate] = useState(initial?.date ?? "");
  const [end, setEnd] = useState(initial?.end ?? "");
  const [endpoint, setEndpoint] = useState<"date" | "end">("date");
  const activeDate = operator === "range" && endpoint === "end" ? end : date;
  const value = serializeDateCondition({ operator, date, end });
  const operators = [
    { value: "exact", label: t("tasks:dateFilter.exact") },
    { value: "range", label: t("tasks:dateFilter.range") },
    { value: "before", label: t("tasks:dateFilter.before") },
    { value: "after", label: t("tasks:dateFilter.after") },
  ] as const;

  return (
    <div className="space-y-3 border-t p-3">
      <div
        role="group"
        aria-label={t("tasks:dateFilter.condition")}
        className="grid grid-cols-2 gap-1"
      >
        {operators.map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={operator === item.value ? "secondary" : "ghost"}
            aria-pressed={operator === item.value}
            onClick={() => {
              setOperator(item.value);
              setEndpoint("date");
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant={endpoint === "date" ? "secondary" : "ghost"}
          className="flex-1"
          aria-pressed={endpoint === "date"}
          onClick={() => setEndpoint("date")}
        >
          {date
            ? formatDateMedium(parseISO(date))
            : operator === "range"
              ? t("tasks:dateFilter.from")
              : t("tasks:dateFilter.date")}
        </Button>
        {operator === "range" && (
          <Button
            type="button"
            size="sm"
            variant={endpoint === "end" ? "secondary" : "ghost"}
            className="flex-1"
            aria-pressed={endpoint === "end"}
            onClick={() => setEndpoint("end")}
          >
            {end ? formatDateMedium(parseISO(end)) : t("tasks:dateFilter.to")}
          </Button>
        )}
      </div>
      <MonthGrid
        key={`${operator}-${endpoint}`}
        value={activeDate ? parseISO(activeDate) : null}
        autoFocus={false}
        defaultMonth={
          activeDate ? parseISO(activeDate) : date ? parseISO(date) : undefined
        }
        marked={operator === "range" && date ? parseISO(date) : undefined}
        disabled={
          operator === "range" && endpoint === "end" && date
            ? [{ before: parseISO(date) }]
            : undefined
        }
        onSelect={(selectedDate) => {
          const day = format(selectedDate, "yyyy-MM-dd");
          if (operator === "range" && endpoint === "end") {
            setEnd(day);
          } else {
            setDate(day);
            if (operator === "range") {
              if (end && end < day) setEnd("");
              setEndpoint("end");
            }
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        className="w-full"
        disabled={!parseDateCondition(value)}
        onClick={() => onApply(value)}
      >
        {t("tasks:dateFilter.apply")}
      </Button>
    </div>
  );
}

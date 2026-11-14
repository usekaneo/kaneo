import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { MonthGrid } from "@/components/common/date-picker/month-grid";
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
  const value = serializeDateCondition({ operator, date, end });
  const operators = [
    { value: "exact", label: t("tasks:dateFilter.exact") },
    { value: "range", label: t("tasks:dateFilter.range") },
    { value: "before", label: t("tasks:dateFilter.before") },
    { value: "after", label: t("tasks:dateFilter.after") },
  ] as const;

  return (
    <div className="space-y-3 border-t p-3">
      <Select
        items={operators}
        value={operator}
        onValueChange={(value) => {
          if (!value) return;
          setOperator(value);
        }}
      >
        <SelectTrigger size="sm" aria-label={t("tasks:dateFilter.condition")}>
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          {operators.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
      {operator === "range" ? (
        <MonthGrid
          mode="range"
          value={
            date
              ? { from: parseISO(date), to: end ? parseISO(end) : undefined }
              : undefined
          }
          autoFocus={false}
          onSelect={(range) => {
            setDate(range.from ? format(range.from, "yyyy-MM-dd") : "");
            setEnd(range.to ? format(range.to, "yyyy-MM-dd") : "");
          }}
        />
      ) : (
        <MonthGrid
          value={date ? parseISO(date) : null}
          autoFocus={false}
          onSelect={(selectedDate) =>
            setDate(format(selectedDate, "yyyy-MM-dd"))
          }
        />
      )}
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

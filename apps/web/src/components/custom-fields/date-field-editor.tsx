import { format, isValid, parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

type DateFieldEditorProps = {
  value: string;
  required: boolean;
  onSelect: (value: string) => void;
};

const toValue = (date: Date) => format(date, "yyyy-MM-dd");

export function DateFieldEditor({
  value,
  required,
  onSelect,
}: DateFieldEditorProps) {
  const { t } = useTranslation();
  const parsed = value ? parseISO(value) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  return (
    <div>
      <Calendar
        mode="single"
        selected={selected}
        defaultMonth={selected}
        onSelect={(date) => {
          if (date) onSelect(toValue(date));
          else if (!required) onSelect("");
        }}
        className="bg-popover"
      />
      <div className="flex items-center justify-between border-border/80 border-t px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => onSelect(toValue(new Date()))}
        >
          {t("tasks:customFields.today")}
        </Button>
        {required ? (
          <span className="px-2 text-muted-foreground text-xs">
            {t("tasks:customFields.required")}
          </span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={!value}
            onClick={() => onSelect("")}
            className="text-muted-foreground"
          >
            {t("tasks:customFields.clear")}
          </Button>
        )}
      </div>
    </div>
  );
}

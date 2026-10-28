import { format, isValid, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DatePickerMenu } from "@/components/common/date-picker/date-picker-menu";
import { formatDateDefault } from "@/components/project/custom-fields/describe-custom-field";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/cn";

type DateDefaultPickerProps = {
  value: string;
  labelledBy: string;
  clearable: boolean;
  onChange: (value: string) => void;
};

export function DateDefaultPicker({
  value,
  labelledBy,
  clearable,
  onChange,
}: DateDefaultPickerProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const parsed = value ? parseISO(value) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-labelledby={labelledBy}
          className={cn(
            "w-full justify-start font-normal sm:w-48",
            !selected && "text-muted-foreground",
          )}
        >
          <CalendarIcon aria-hidden="true" />
          {selected
            ? formatDateDefault(value, i18n?.language)
            : t("settings:customFields.noDefault")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-65 p-0">
        <DatePickerMenu
          label={t("settings:customFields.defaultLabel")}
          placeholder={t("tasks:datePicker.datePlaceholder")}
          clearLabel={t("settings:customFields.clearDefault")}
          value={selected ?? null}
          canClear={clearable && selected !== undefined}
          onChange={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

import { format, isValid, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDateDefault } from "@/components/project/custom-fields/describe-custom-field";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
      <PopoverContent align="end" className="w-auto">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
        />
        {clearable && selected ? (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {t("settings:customFields.clearDefault")}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

import { EyeOff, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  name: string;
  options: string[];
  value: string[];
  hiddenOptions?: string[];
  required?: boolean;
  disabled?: boolean;
  onChange: (value: string[]) => void;
  onCommit: (value: string[]) => void;
};

export default function CustomFieldMultiSelect({
  name,
  options,
  value,
  disabled,
  hiddenOptions = [],
  required = false,
  onChange,
  onCommit,
}: Props) {
  const { t } = useTranslation();
  const visibleOptions = options.filter(
    (option) => !hiddenOptions.includes(option),
  );
  const hiddenSelections = value.filter((option) =>
    hiddenOptions.includes(option),
  );
  return (
    <div className="space-y-2">
      <Select
        multiple
        items={options.map((option) => ({
          value: option,
          label: option,
        }))}
        value={value}
        onValueChange={onChange}
        onOpenChange={(open) => {
          if (!open) onCommit(value);
        }}
        disabled={disabled || visibleOptions.length === 0}
      >
        <SelectTrigger
          aria-label={name}
          className="h-9 w-full min-w-0 bg-background text-sm"
        >
          <SelectValue
            className="min-w-0"
            title={value.join(", ")}
            placeholder={t("tasks:detail.selectOption")}
          >
            {(selected: string[]) =>
              selected.length
                ? selected.join(", ")
                : t("tasks:detail.selectOption")
            }
          </SelectValue>
          {value.length > 1 && (
            <span
              aria-hidden="true"
              className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
            >
              {value.length}
            </span>
          )}
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          className="w-(--anchor-width)"
        >
          {options.map((option) => (
            <SelectItem
              key={option}
              value={option}
              hidden={hiddenOptions.includes(option)}
              disabled={hiddenOptions.includes(option)}
              className={
                hiddenOptions.includes(option)
                  ? "hidden"
                  : "grid-cols-[1rem_minmax(0,1fr)] items-start py-1.5 leading-5"
              }
            >
              <span className="block whitespace-normal break-words text-left">
                {option}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hiddenSelections.length > 0 && (
        <ul className="space-y-1">
          {hiddenSelections.map((option) => (
            <li
              key={option}
              className="flex items-start gap-1.5 text-xs text-muted-foreground"
            >
              <EyeOff aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 break-words">
                {option} · {t("settings:customFields.hidden")}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5 shrink-0"
                disabled={disabled || (required && value.length === 1)}
                aria-label={t("settings:customFields.removeHiddenSelection", {
                  option,
                })}
                onClick={() => {
                  const next = value.filter((item) => item !== option);
                  onChange(next);
                  onCommit(next);
                }}
              >
                <X className="size-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

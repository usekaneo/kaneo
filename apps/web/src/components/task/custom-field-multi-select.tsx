import { useTranslation } from "react-i18next";
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
  disabled?: boolean;
  onChange: (value: string[]) => void;
  onCommit: (value: string[]) => void;
};

export default function CustomFieldMultiSelect({
  name,
  options,
  value,
  disabled,
  onChange,
  onCommit,
}: Props) {
  const { t } = useTranslation();
  return (
    <Select
      multiple
      items={options.map((option) => ({ value: option, label: option }))}
      value={value}
      onValueChange={onChange}
      onOpenChange={(open) => {
        if (!open) onCommit(value);
      }}
      disabled={disabled || options.length === 0}
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
            className="grid-cols-[1rem_minmax(0,1fr)] items-start py-1.5 leading-5"
          >
            <span className="block whitespace-normal break-words text-left">
              {option}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

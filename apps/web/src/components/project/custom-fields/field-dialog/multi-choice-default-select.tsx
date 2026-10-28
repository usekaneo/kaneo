import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MultiChoiceDefaultSelectProps = {
  options: string[];
  value: string[];
  labelledBy: string;
  onChange: (value: string[]) => void;
};

export function MultiChoiceDefaultSelect({
  options,
  value,
  labelledBy,
  onChange,
}: MultiChoiceDefaultSelectProps) {
  const { t } = useTranslation();

  return (
    <Select
      multiple
      value={value}
      disabled={options.length === 0}
      onValueChange={(next) => onChange(next ?? [])}
    >
      <SelectTrigger
        size="sm"
        aria-labelledby={labelledBy}
        className="w-full sm:w-48"
      >
        <SelectValue>
          {value.length > 0 ? (
            value.join(", ")
          ) : (
            <span className="text-muted-foreground">
              {t("settings:customFields.noDefault")}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

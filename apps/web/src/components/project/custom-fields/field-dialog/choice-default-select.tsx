import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NO_DEFAULT = "__none__";

type ChoiceDefaultSelectProps = {
  options: string[];
  value: string;
  labelledBy: string;
  clearable: boolean;
  onChange: (value: string) => void;
};

export function ChoiceDefaultSelect({
  options,
  value,
  labelledBy,
  clearable,
  onChange,
}: ChoiceDefaultSelectProps) {
  const { t } = useTranslation();
  const noDefault = (
    <span className="text-muted-foreground">
      {t("settings:customFields.noDefault")}
    </span>
  );

  return (
    <Select
      value={value || NO_DEFAULT}
      disabled={options.length === 0}
      onValueChange={(next) =>
        onChange(!next || next === NO_DEFAULT ? "" : next)
      }
    >
      <SelectTrigger
        size="sm"
        aria-labelledby={labelledBy}
        className="w-full sm:w-48"
      >
        <SelectValue>{value || noDefault}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {clearable ? (
          <SelectItem value={NO_DEFAULT}>{noDefault}</SelectItem>
        ) : null}
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

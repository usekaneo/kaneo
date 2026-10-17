import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CheckboxDefaultSelectProps = {
  value: string;
  labelledBy: string;
  onChange: (value: string) => void;
};

export function CheckboxDefaultSelect({
  value,
  labelledBy,
  onChange,
}: CheckboxDefaultSelectProps) {
  const { t } = useTranslation();
  const checked = value === "true";

  return (
    <Select
      value={checked ? "true" : "false"}
      onValueChange={(next) => onChange(next === "true" ? "true" : "false")}
    >
      <SelectTrigger
        size="sm"
        aria-labelledby={labelledBy}
        className="w-full sm:w-48"
      >
        <SelectValue>
          {checked
            ? t("settings:customFields.checked")
            : t("settings:customFields.unchecked")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="false">
          {t("settings:customFields.unchecked")}
        </SelectItem>
        <SelectItem value="true">
          {t("settings:customFields.checked")}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

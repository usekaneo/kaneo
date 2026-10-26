import { useTranslation } from "react-i18next";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UserFilterSelectProps<Value extends string> = {
  label: string;
  value: Value;
  options: readonly { value: Value; labelKey: string }[];
  onValueChange: (value: Value) => void;
};

export function UserFilterSelect<Value extends string>({
  label,
  value,
  options,
  onValueChange,
}: UserFilterSelectProps<Value>) {
  const { t } = useTranslation();
  const items = options.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }));
  const selected = items.find((item) => item.value === value) ?? items[0];

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        const option = options.find((candidate) => candidate.value === next);
        if (option) onValueChange(option.value);
      }}
    >
      <SelectTrigger size="sm" aria-label={label} className="w-full sm:w-36">
        <SelectValue>{selected?.label}</SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {items.map((item) => (
          <SelectItem key={item.value || "any"} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}

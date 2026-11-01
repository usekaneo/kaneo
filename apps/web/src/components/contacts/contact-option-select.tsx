import { useTranslation } from "react-i18next";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ContactOptionSelectProps = {
  value: string;
  options: readonly string[];
  labelKey: (option: string) => string;
  onValueChange: (value: string) => void;
  id?: string;
  label?: string;
  size?: "sm" | "default";
};

export function ContactOptionSelect({
  value,
  options,
  labelKey,
  onValueChange,
  id,
  label,
  size,
}: ContactOptionSelectProps) {
  const { t } = useTranslation();
  const items = options.map((option) => ({
    value: option,
    label: t(labelKey(option)),
  }));

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string" && next) onValueChange(next);
      }}
    >
      <SelectTrigger id={id} aria-label={label} size={size}>
        <SelectValue>{t(labelKey(value))}</SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}

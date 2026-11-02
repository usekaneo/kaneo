import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ContactOptionItem = { value: string; label: string };

type ContactOptionSelectProps = {
  value: string;
  items: ContactOptionItem[];
  onValueChange: (value: string) => void;
  label: string;
  id?: string;
  size?: "sm" | "default";
  disabled?: boolean;
};

export function ContactOptionSelect({
  value,
  items,
  onValueChange,
  label,
  id,
  size,
  disabled,
}: ContactOptionSelectProps) {
  return (
    <Select
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (typeof next === "string") onValueChange(next);
      }}
    >
      <SelectTrigger id={id} aria-label={label} size={size}>
        <SelectValue>
          {items.find((item) => item.value === value)?.label ?? items[0]?.label}
        </SelectValue>
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

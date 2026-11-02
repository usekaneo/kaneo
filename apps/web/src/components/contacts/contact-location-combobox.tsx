import { useTranslation } from "react-i18next";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "@/components/ui/combobox";
import type { ContactOptionItem } from "./contact-option-select";

type ContactLocationComboboxProps = {
  value: string;
  items: ContactOptionItem[];
  onValueChange: (value: string) => void;
  label: string;
  id?: string;
  size?: "sm" | "default";
  disabled?: boolean;
};

// Locations can number in the hundreds, so this is searchable. The first item
// is the "none" choice (value ""), which typing filters away like any other.
export function ContactLocationCombobox({
  value,
  items,
  onValueChange,
  label,
  id,
  size,
  disabled,
}: ContactLocationComboboxProps) {
  const { t } = useTranslation();
  const selected = items.find((item) => item.value === value) ?? items[0];

  return (
    <Combobox
      items={items}
      value={selected ?? null}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next?.value ?? "")}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(item, current) => item.value === current.value}
    >
      <ComboboxInput
        id={id}
        size={size}
        aria-label={label}
        placeholder={t("workspace:contacts.searchLocations")}
      />
      <ComboboxPopup>
        <ComboboxEmpty>{t("workspace:contacts.noLocations")}</ComboboxEmpty>
        <ComboboxList>
          {(item: ContactOptionItem) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}

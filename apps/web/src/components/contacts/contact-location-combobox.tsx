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
// is the "none" choice (value ""). It is shown as the placeholder, never as text
// in the field: text there would be prepended to whatever the user types.
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
  const none = items.find((item) => item.value === "");
  const selected =
    items.find((item) => item.value === value) ?? none ?? items[0];

  return (
    <Combobox
      items={items}
      value={selected ?? null}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next?.value ?? "")}
      itemToStringLabel={(item) => (item.value === "" ? "" : item.label)}
      isItemEqualToValue={(item, current) => item.value === current.value}
    >
      <ComboboxInput
        id={id}
        size={size}
        aria-label={label}
        placeholder={none?.label ?? t("workspace:contacts.searchLocations")}
        // Select what is shown so typing replaces it instead of appending.
        onFocus={(event) => event.currentTarget.select()}
        onClick={(event) => event.currentTarget.select()}
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

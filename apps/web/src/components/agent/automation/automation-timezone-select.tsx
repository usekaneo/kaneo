import { Globe } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "@/components/ui/combobox";
import { listTimeZones } from "./list-time-zones";

type AutomationTimezoneSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
};

export function AutomationTimezoneSelect({
  value,
  onValueChange,
}: AutomationTimezoneSelectProps) {
  const { t } = useTranslation();
  const zones = useMemo(() => listTimeZones(value), [value]);

  return (
    <Combobox
      items={zones}
      value={value}
      onValueChange={(next: string | null) => {
        if (next) onValueChange(next);
      }}
    >
      <ComboboxInput
        size="sm"
        aria-label={t("agent:automations.form.timezone")}
        startAddon={<Globe aria-hidden="true" />}
      />
      <ComboboxPopup>
        <ComboboxEmpty>{t("agent:automations.form.noTimezones")}</ComboboxEmpty>
        <ComboboxList>
          {(zone: string) => (
            <ComboboxItem key={zone} value={zone}>
              {zone}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}

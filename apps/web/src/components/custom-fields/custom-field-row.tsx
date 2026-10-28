import { useTranslation } from "react-i18next";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { PropertyRow } from "@/components/task/properties/property-row";
import { PropertyValue } from "@/components/task/properties/property-value";
import { CheckboxMark } from "./checkbox-mark";
import { CustomFieldPopover } from "./custom-field-popover";
import { formatCustomFieldValue } from "./format-custom-field-value";

type CustomFieldRowProps = {
  field: CustomFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function CustomFieldRow({
  field,
  value,
  onChange,
  disabled = false,
}: CustomFieldRowProps) {
  const { t } = useTranslation();

  if (field.type === "boolean") {
    const checked = value === "true";
    return (
      <PropertyRow label={field.name}>
        <PropertyValue
          role="checkbox"
          aria-checked={checked}
          aria-label={field.name}
          disabled={disabled}
          onClick={() => onChange(checked ? "false" : "true")}
        >
          <CheckboxMark checked={checked} />
        </PropertyValue>
      </PropertyRow>
    );
  }

  const display = formatCustomFieldValue(field.type, value, "medium");
  const button = (
    <PropertyValue disabled={disabled} aria-label={field.name}>
      {display ? (
        <>
          <span className="truncate" title={display.text}>
            {display.text}
          </span>
          {!!display.more && (
            <span className="shrink-0 text-muted-foreground">
              +{display.more}
            </span>
          )}
        </>
      ) : (
        <span className="truncate font-normal text-muted-foreground/70">
          {t("tasks:customFields.empty")}
        </span>
      )}
    </PropertyValue>
  );

  return (
    <PropertyRow label={field.name}>
      {disabled ? (
        button
      ) : (
        <CustomFieldPopover
          field={field}
          value={value}
          onChange={onChange}
          side="left"
        >
          {button}
        </CustomFieldPopover>
      )}
    </PropertyRow>
  );
}

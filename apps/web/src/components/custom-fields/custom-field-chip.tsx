import { useTranslation } from "react-i18next";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { cn } from "@/lib/cn";
import { CheckboxMark } from "./checkbox-mark";
import { CustomFieldPopover } from "./custom-field-popover";
import { CustomFieldTypeIcon } from "./custom-field-type-icon";
import { formatCustomFieldValue } from "./format-custom-field-value";
import { isCustomFieldValueEmpty } from "./missing-required-fields";
import { propertyChipClass } from "./property-chip-class";

type CustomFieldChipProps = {
  field: CustomFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
};

export function CustomFieldChip({
  field,
  value,
  onChange,
  invalid = false,
  disabled = false,
  className,
}: CustomFieldChipProps) {
  const { t } = useTranslation();

  if (field.type === "boolean") {
    const checked = value === "true";
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(checked ? "false" : "true")}
        className={cn(
          propertyChipClass,
          checked && "bg-accent/30 text-foreground",
          className,
        )}
      >
        <CheckboxMark checked={checked} />
        <span className="truncate">{field.name}</span>
      </button>
    );
  }

  const display = formatCustomFieldValue(field.type, value, "short");
  const missing = field.required && isCustomFieldValueEmpty(field.type, value);

  const chip = (
    <button
      type="button"
      disabled={disabled}
      data-custom-field={field.id}
      className={cn(
        propertyChipClass,
        display && "bg-accent/30",
        invalid &&
          "border-destructive/50 bg-destructive/8 text-destructive-foreground focus-visible:ring-destructive/40",
        className,
      )}
    >
      <CustomFieldTypeIcon type={field.type} className="size-3.5 shrink-0" />
      <span className="shrink-0">{field.name}</span>
      {display && (
        <span
          className="min-w-0 max-w-40 truncate text-foreground"
          title={display.text}
        >
          {display.text}
        </span>
      )}
      {!!display?.more && <span className="shrink-0">+{display.more}</span>}
      {missing && (
        <>
          {!invalid && (
            <span
              aria-hidden="true"
              className="size-[5px] shrink-0 rounded-full bg-destructive-foreground in-data-popup-open:hidden"
            />
          )}
          <span className="sr-only">{t("tasks:customFields.required")}</span>
        </>
      )}
    </button>
  );

  if (disabled) return chip;

  return (
    <CustomFieldPopover field={field} value={value} onChange={onChange}>
      {chip}
    </CustomFieldPopover>
  );
}

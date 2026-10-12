import { useTranslation } from "react-i18next";
import type { CustomFieldDefinition } from "@/components/project/custom-fields/types";
import { CheckboxMark } from "./checkbox-mark";
import { CustomFieldPopover } from "./custom-field-popover";
import { CustomFieldTypeIcon } from "./custom-field-type-icon";
import { formatCustomFieldValue } from "./format-custom-field-value";

type CustomFieldRowProps = {
  field: CustomFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const rowClass =
  "group/row flex h-7 w-full min-w-0 items-center gap-2 rounded-md px-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring enabled:hover:bg-accent data-popup-open:bg-accent";

export function CustomFieldRow({
  field,
  value,
  onChange,
  disabled = false,
}: CustomFieldRowProps) {
  const { t } = useTranslation();
  const label = (
    <>
      <CustomFieldTypeIcon
        type={field.type}
        className="size-3.5 shrink-0 text-muted-foreground group-data-popup-open/row:text-sidebar-foreground"
      />
      <span className="w-26 shrink-0 truncate font-medium text-muted-foreground group-data-popup-open/row:text-sidebar-foreground">
        {field.name}
      </span>
    </>
  );

  if (field.type === "boolean") {
    const checked = value === "true";
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={field.name}
        disabled={disabled}
        onClick={() => onChange(checked ? "false" : "true")}
        className={rowClass}
      >
        {label}
        <CheckboxMark checked={checked} />
      </button>
    );
  }

  const display = formatCustomFieldValue(field.type, value, "medium");
  const row = (
    <button type="button" disabled={disabled} className={rowClass}>
      {label}
      {display ? (
        <span className="flex min-w-0 items-center gap-1.5 font-semibold text-foreground">
          <span className="truncate" title={display.text}>
            {display.text}
          </span>
          {!!display.more && (
            <span className="shrink-0 font-medium text-muted-foreground">
              +{display.more}
            </span>
          )}
        </span>
      ) : (
        <span className="truncate text-muted-foreground/70">
          {t("tasks:customFields.empty")}
        </span>
      )}
    </button>
  );

  if (disabled) return row;

  return (
    <CustomFieldPopover
      field={field}
      value={value}
      onChange={onChange}
      side="left"
    >
      {row}
    </CustomFieldPopover>
  );
}

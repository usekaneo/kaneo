import type { CardField } from "./card-fields";
import { CheckboxMark } from "./checkbox-mark";
import { CustomFieldTypeIcon } from "./custom-field-type-icon";
import { formatCustomFieldValue } from "./format-custom-field-value";

export function CardFieldOverflowRow({ field }: { field: CardField }) {
  const display = formatCustomFieldValue(field.type, field.value, "short");

  return (
    <div className="contents text-xs">
      <CustomFieldTypeIcon
        type={field.type}
        className="size-3.5 text-muted-foreground"
      />
      <span className="max-w-32 truncate font-medium text-muted-foreground">
        {field.name}
      </span>
      {field.type === "boolean" ? (
        <CheckboxMark checked />
      ) : (
        <span className="flex min-w-0 max-w-44 items-center gap-1.5 font-semibold text-foreground">
          <span className="truncate">{display?.text}</span>
          {!!display?.more && (
            <span className="shrink-0 font-medium text-muted-foreground">
              +{display.more}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

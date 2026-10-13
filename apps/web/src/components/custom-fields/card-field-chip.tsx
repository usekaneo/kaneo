import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CardField } from "./card-fields";
import { CheckboxMark } from "./checkbox-mark";
import { CustomFieldTypeIcon } from "./custom-field-type-icon";
import { formatCustomFieldValue } from "./format-custom-field-value";

export const cardChipClass =
  "inline-flex h-5 min-w-0 shrink-0 items-center gap-1 rounded-[5px] border border-border px-1.5 font-medium text-[11px] text-foreground/85 transition-colors hover:bg-accent";

export function CardFieldChip({ field }: { field: CardField }) {
  const display = formatCustomFieldValue(field.type, field.value, "short");

  return (
    <Tooltip>
      <TooltipTrigger render={<span className={cardChipClass} />}>
        {field.type === "boolean" ? (
          <>
            <CheckboxMark checked className="size-3" />
            <span className="max-w-18 truncate">{field.name}</span>
          </>
        ) : (
          <>
            <CustomFieldTypeIcon
              type={field.type}
              className="size-3 shrink-0 text-muted-foreground"
            />
            <span className="sr-only">{field.name}: </span>
            <span className="max-w-18 truncate">{display?.text}</span>
            {!!display?.more && (
              <span className="text-muted-foreground">+{display.more}</span>
            )}
          </>
        )}
      </TooltipTrigger>
      <TooltipContent>{field.name}</TooltipContent>
    </Tooltip>
  );
}

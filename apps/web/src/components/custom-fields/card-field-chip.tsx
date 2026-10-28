import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { taskChipClass } from "@/components/task-chips/task-chip-class";
import type { CardField } from "./card-fields";
import { CheckboxMark } from "./checkbox-mark";
import { formatCustomFieldValue } from "./format-custom-field-value";

export const cardChipClass = taskChipClass;

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
            <span className="max-w-24 truncate text-muted-foreground">
              {field.name}
            </span>
            <span className="max-w-24 truncate">{display?.text}</span>
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

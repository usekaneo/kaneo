import type { SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/preview-card";
import { cn } from "@/lib/cn";
import { CardFieldChip, cardChipClass } from "./card-field-chip";
import { CardFieldOverflowRow } from "./card-field-overflow-row";
import type { CardField } from "./card-fields";

type CardFieldListProps = {
  fields: CardField[];
  max: number;
  className?: string;
};

const keepCardIdle = (event: SyntheticEvent) => {
  event.stopPropagation();
  event.preventDefault();
};

export function CardFieldList({ fields, max, className }: CardFieldListProps) {
  const { t } = useTranslation();

  if (fields.length === 0) return null;

  const hidden = fields.slice(max);

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      {fields.slice(0, max).map((field) => (
        <CardFieldChip key={field.fieldId} field={field} />
      ))}
      {hidden.length > 0 && (
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              aria-label={t("tasks:customFields.moreFields", {
                count: hidden.length,
              })}
              onClick={keepCardIdle}
              onPointerDown={keepCardIdle}
              className={cn(
                cardChipClass,
                "cursor-default text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              +{hidden.length}
            </button>
          </HoverCardTrigger>
          <HoverCardContent
            side="bottom"
            align="end"
            className="w-auto p-1"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="grid auto-rows-7 grid-cols-[auto_auto_auto] items-center gap-x-3 px-1.5">
              {hidden.map((field) => (
                <CardFieldOverflowRow key={field.fieldId} field={field} />
              ))}
            </div>
          </HoverCardContent>
        </HoverCard>
      )}
    </div>
  );
}

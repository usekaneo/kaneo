import { CheckIcon } from "lucide-react";
import labelColors from "@/constants/label-colors";
import { cn } from "@/lib/cn";

type LabelColorSwatchesProps = {
  value: string;
  onChange: (value: string) => void;
  labelledBy: string;
};

export function LabelColorSwatches({
  value,
  onChange,
  labelledBy,
}: LabelColorSwatchesProps) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      className="flex flex-wrap items-center gap-2.5"
    >
      {labelColors.map((color) => {
        const selected = color.value === value;

        return (
          <button
            key={color.value}
            type="button"
            aria-label={color.label}
            aria-pressed={selected}
            title={color.label}
            onClick={() => onChange(color.value)}
            className={cn(
              "flex size-6 cursor-pointer items-center justify-center rounded-full text-white outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
              selected &&
                "ring-2 ring-foreground/70 ring-offset-2 ring-offset-popover",
            )}
            style={{ backgroundColor: color.color }}
          >
            {selected ? (
              <CheckIcon
                aria-hidden="true"
                className="size-3"
                strokeWidth={3}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

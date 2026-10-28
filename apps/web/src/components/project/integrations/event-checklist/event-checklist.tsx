import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import type { EventChecklistItem } from "./event-checklist-item";

type EventChecklistProps<K extends string> = {
  label: ReactNode;
  items: EventChecklistItem<K>[];
  value: Record<K, boolean>;
  onChange: (value: Record<K, boolean>) => void;
  columns?: 2 | 3;
  disabled?: boolean;
  children?: ReactNode;
};

export function EventChecklist<K extends string>({
  label,
  items,
  value,
  onChange,
  columns = 2,
  disabled = false,
  children,
}: EventChecklistProps<K>) {
  const { t } = useTranslation();
  const labelId = useId();

  return (
    <div className="space-y-2">
      <p id={labelId} className="text-sm font-medium">
        {label}
      </p>
      <div
        role="group"
        aria-labelledby={labelId}
        className="rounded-lg border border-border p-1.5"
      >
        <div
          className={cn(
            "grid grid-cols-1",
            columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
          )}
        >
          {items.map((item) => (
            <Label
              key={item.id}
              className="flex min-h-8.5 gap-2.5 px-2 py-1.5 font-normal"
            >
              <Checkbox
                checked={value[item.id]}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  onChange({ ...value, [item.id]: checked })
                }
              />
              {t(item.labelKey)}
            </Label>
          ))}
        </div>
        {children ? (
          <div className="mt-1.5 border-t border-border px-2 pt-2 pb-1">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

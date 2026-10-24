import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

type HabitCheckCellProps = {
  done: boolean;
  disabled: boolean;
  label: string;
  onToggle: () => void;
};

export function HabitCheckCell({
  done,
  disabled,
  label,
  onToggle,
}: HabitCheckCellProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex size-6 items-center justify-center rounded-md border outline-none transition-[background-color,border-color,scale] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-90 disabled:cursor-default disabled:opacity-35 disabled:active:scale-100",
        done
          ? "border-emerald-600 bg-emerald-500 text-white dark:border-emerald-500 dark:bg-emerald-600"
          : "border-input bg-background hover:border-emerald-500/60",
      )}
    >
      {done && <Check className="size-4" strokeWidth={3} aria-hidden="true" />}
    </button>
  );
}

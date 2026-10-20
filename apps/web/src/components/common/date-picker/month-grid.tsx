import { startOfDay } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayPicker, type Matcher } from "react-day-picker";
import { cn } from "@/lib/cn";
import { useUserPreferencesStore } from "@/store/user-preferences";

const navButtonClass =
  "flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5";

const classNames = {
  root: "px-2.5 pb-2.5",
  months: "relative",
  month: "flex flex-col",
  month_caption: "flex h-10 items-center px-0.5",
  caption_label: "font-medium text-[13px] text-foreground",
  nav: "absolute end-0 top-0 z-1 flex h-10 items-center gap-0.5",
  button_previous: navButtonClass,
  button_next: navButtonClass,
  month_grid: "w-full border-separate border-spacing-y-1",
  weekday: "h-6 p-0 font-normal text-[11px] text-muted-foreground/70",
  day: "p-0 text-center",
  day_button:
    "relative mx-auto flex size-7.5 cursor-pointer items-center justify-center rounded-lg text-[13px] text-foreground/85 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40",
  today:
    "*:ring-1 *:ring-foreground/20 *:ring-inset not-data-selected:not-data-disabled:*:text-foreground",
  selected:
    "*:bg-foreground *:font-medium *:text-background *:hover:bg-foreground",
  outside: "not-data-selected:*:text-muted-foreground/40",
  disabled: "*:pointer-events-none *:text-muted-foreground/40",
  hidden: "invisible",
};

const modifiersClassNames = {
  past: "not-data-selected:*:text-muted-foreground/70",
  limit:
    "*:after:absolute *:after:bottom-0.5 *:after:start-1/2 *:after:size-1 *:after:-translate-x-1/2 *:after:rounded-full *:after:bg-muted-foreground data-selected:*:after:bg-background",
};

function Chevron({
  orientation,
  className,
}: {
  orientation?: "left" | "right" | "up" | "down";
  className?: string;
}) {
  const Icon = orientation === "left" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <Icon aria-hidden="true" className={cn(className, "rtl:rotate-180")} />
  );
}

type MonthGridProps = {
  value: Date | null;
  onSelect: (date: Date) => void;
  disabled?: Matcher[];
  marked?: Date;
  autoFocus?: boolean;
};

export function MonthGrid({
  value,
  onSelect,
  disabled,
  marked,
  autoFocus = true,
}: MonthGridProps) {
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const today = startOfDay(new Date());

  return (
    <DayPicker
      mode="single"
      required
      autoFocus={autoFocus}
      showOutsideDays
      selected={value ?? undefined}
      defaultMonth={value ?? today}
      onSelect={onSelect}
      disabled={disabled}
      weekStartsOn={weekStartsOn}
      modifiers={{ past: { before: today }, limit: marked ?? false }}
      modifiersClassNames={modifiersClassNames}
      classNames={classNames}
      components={{ Chevron }}
    />
  );
}

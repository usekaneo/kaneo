import { CheckCircle2, Circle } from "lucide-react";
import columnIcons, {
  DEFAULT_COLUMN_ICON_NAMES,
} from "@/constants/column-icons";
import { cn } from "@/lib/cn";

type Tone = "planned" | "todo" | "progress" | "review" | "done" | "archived";

// One colour per kind of status, so a glance at any list tells work apart:
// grey waits, amber moves, violet is being checked, green is finished.
const TONES: Record<Tone, { icon: string; pill: string }> = {
  planned: {
    icon: "text-muted-foreground/70",
    pill: "bg-muted text-muted-foreground",
  },
  todo: {
    icon: "text-slate-400",
    pill: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  progress: {
    icon: "text-amber-500",
    pill: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  review: {
    icon: "text-violet-500",
    pill: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  done: {
    icon: "text-emerald-500",
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  archived: {
    icon: "text-muted-foreground/60",
    pill: "bg-muted text-muted-foreground",
  },
};

const TONE_BY_SLUG: Record<string, Tone> = {
  planned: "planned",
  "to-do": "todo",
  "in-progress": "progress",
  "in-review": "review",
  done: "done",
  archived: "archived",
};

// Custom columns have their own slugs; their icon says what they're like.
const TONE_BY_ICON: Record<string, Tone> = {
  CircleDashed: "planned",
  Circle: "todo",
  CircleDot: "progress",
  Search: "review",
  CheckCircle2: "done",
  Archive: "archived",
};

function toneOf(columnId: string, isFinal?: boolean, iconName?: string | null) {
  return (
    TONE_BY_SLUG[columnId] ??
    (iconName ? TONE_BY_ICON[iconName] : undefined) ??
    (isFinal ? "done" : "todo")
  );
}

/** Soft background and text colour for a status shown as a pill. */
export const getStatusPillClass = (
  columnId: string,
  isFinal?: boolean,
  iconName?: string | null,
) => TONES[toneOf(columnId, isFinal, iconName)].pill;

export const getColumnIcon = (
  columnId: string,
  isFinal?: boolean,
  iconName?: string | null,
) => {
  const resolvedIconName =
    iconName ||
    DEFAULT_COLUMN_ICON_NAMES[
      columnId as keyof typeof DEFAULT_COLUMN_ICON_NAMES
    ];
  const Icon =
    resolvedIconName &&
    columnIcons[resolvedIconName as keyof typeof columnIcons];
  const className = cn(
    "w-4 h-4 shrink-0",
    TONES[toneOf(columnId, isFinal, iconName)].icon,
  );

  if (Icon) return <Icon className={className} />;
  return isFinal ? (
    <CheckCircle2 className={className} />
  ) : (
    <Circle className={className} />
  );
};

import { cn } from "@/lib/cn";

const MARKS = [3, 7, 11];

const FILLED: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 3,
};

type PriorityGlyphProps = {
  priority: string | null | undefined;
  className?: string;
};

export function PriorityGlyph({ priority, className }: PriorityGlyphProps) {
  const filled = FILLED[priority ?? ""] ?? 0;
  const urgent = priority === "urgent";

  return (
    <svg
      viewBox="0 0 14 14"
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", className)}
    >
      {MARKS.map((x, index) => {
        const tone =
          index >= filled
            ? "fill-priority-bar-empty stroke-priority-bar-empty"
            : urgent
              ? "fill-priority-urgent stroke-priority-urgent"
              : "fill-priority-bar stroke-priority-bar";
        return (
          <g key={x} className={tone}>
            <path
              d={`M${x} 2.5v5.5`}
              fill="none"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <circle cx={x} cy="11" r="1" stroke="none" />
          </g>
        );
      })}
    </svg>
  );
}

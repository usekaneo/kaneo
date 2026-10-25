import { cn } from "@/lib/cn";

const MARKS = [3, 7, 11];

const LEVELS: Record<string, { filled: number; tone: string }> = {
  low: { filled: 1, tone: "fill-priority-low stroke-priority-low" },
  medium: { filled: 2, tone: "fill-priority-medium stroke-priority-medium" },
  high: { filled: 3, tone: "fill-priority-high stroke-priority-high" },
  urgent: { filled: 3, tone: "fill-priority-urgent stroke-priority-urgent" },
};

type PriorityGlyphProps = {
  priority: string | null | undefined;
  className?: string;
};

export function PriorityGlyph({ priority, className }: PriorityGlyphProps) {
  const { filled, tone } = LEVELS[priority ?? ""] ?? { filled: 0, tone: "" };

  return (
    <svg
      viewBox="0 0 14 14"
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", className)}
    >
      {MARKS.map((x, index) => (
        <g
          key={x}
          className={
            index < filled
              ? tone
              : "fill-priority-bar-empty stroke-priority-bar-empty"
          }
        >
          <path
            d={`M${x} 2.5v5.5`}
            fill="none"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <circle cx={x} cy="11" r="1" stroke="none" />
        </g>
      ))}
    </svg>
  );
}

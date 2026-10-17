import { cn } from "@/lib/cn";

type ProjectProgressProps = {
  percentage: number;
  className?: string;
};

const RADIUS = 2.25;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// A filled wedge rather than a ring: a partial ring reads as a spinner.
export function ProjectProgress({
  percentage,
  className,
}: ProjectProgressProps) {
  const clamped = Math.min(100, Math.max(0, percentage));

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 14 14"
      className={cn("size-3.5 shrink-0", className)}
    >
      <circle
        cx="7"
        cy="7"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="7"
        cy="7"
        r={RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={RADIUS * 2}
        strokeDasharray={`${(clamped / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        transform="rotate(-90 7 7)"
      />
    </svg>
  );
}

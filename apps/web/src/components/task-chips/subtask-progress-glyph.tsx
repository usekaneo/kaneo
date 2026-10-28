const RADIUS = 4.75;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type SubtaskProgressGlyphProps = {
  completed: number;
  total: number;
};

export function SubtaskProgressGlyph({
  completed,
  total,
}: SubtaskProgressGlyphProps) {
  if (total > 0 && completed >= total) {
    return (
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="5.5" className="fill-priority-bar" />
        <path
          d="m3.6 6.2 1.6 1.6 3.2-3.4"
          fill="none"
          className="stroke-board-card"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const progress = total > 0 ? completed / total : 0;
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="-rotate-90">
      <circle
        cx="6"
        cy="6"
        r={RADIUS}
        fill="none"
        className="stroke-priority-bar-empty"
        strokeWidth="1.5"
      />
      {completed > 0 && (
        <circle
          cx="6"
          cy="6"
          r={RADIUS}
          fill="none"
          className="stroke-priority-bar"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
        />
      )}
    </svg>
  );
}

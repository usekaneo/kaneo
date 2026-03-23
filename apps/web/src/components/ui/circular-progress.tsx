type CircularProgressProps = {
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
};

export default function CircularProgress({
  completed,
  total,
  size = 16,
  strokeWidth = 2,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = total > 0 ? completed / total : 0;
  const offset = circumference * (1 - percent);

  return (
    <svg
      width={size}
      height={size}
      className="shrink-0 -rotate-90"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-border"
      />
      {total > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={
            completed === total ? "text-success-foreground" : "text-primary"
          }
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      )}
    </svg>
  );
}

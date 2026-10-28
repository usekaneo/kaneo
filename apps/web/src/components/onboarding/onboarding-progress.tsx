import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

type OnboardingProgressProps = { current: number; total: number };

export function OnboardingProgress({
  current,
  total,
}: OnboardingProgressProps) {
  const { t } = useTranslation();
  const segments = Array.from({ length: total }, (_, position) => ({
    id: `segment-${position}`,
    done: position < current,
  }));

  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={t("auth:onboarding.progress", { current, total })}
      className="flex items-center gap-3"
    >
      <span className="font-mono text-muted-foreground text-xs">
        {current} / {total}
      </span>
      <span className="flex gap-1">
        {segments.map((segment) => (
          <span
            key={segment.id}
            className={cn(
              "h-1 w-6 rounded-full transition-colors duration-300",
              segment.done ? "bg-foreground" : "bg-foreground/12",
            )}
          />
        ))}
      </span>
    </div>
  );
}

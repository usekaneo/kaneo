import type { TFunction } from "i18next";

export default function formatDuration(
  totalSeconds: number,
  t: TFunction,
): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) {
    return t("tasks:timeTracking.durationSeconds", { seconds });
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0
    ? t("tasks:timeTracking.durationHoursMinutes", { hours, minutes })
    : t("tasks:timeTracking.durationMinutes", { minutes });
}

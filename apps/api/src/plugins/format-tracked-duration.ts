export function formatTrackedDuration(totalSeconds: number | null): string {
  const seconds = Math.floor(totalSeconds ?? 0);
  if (seconds <= 0) {
    return "no time";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
    remainingSeconds > 0 ? `${remainingSeconds}s` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
}

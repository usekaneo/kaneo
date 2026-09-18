export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

// Live timer display: 0:04:09, 12:30:00.
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// Totals in timesheets: 45m, 2h, 2h 05m.
export function formatHours(seconds: number): string {
  const totalMinutes = Math.round(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

// Reads what people type for an estimate: "3h", "90m", "1h 30m", "1.5",
// "2:30". A bare number means hours. Returns minutes, or null if unreadable.
export function parseDurationInput(input: string): number | null {
  const text = input.trim().toLowerCase().replace(",", ".");
  if (!text) return null;

  const clock = text.match(/^(\d+):([0-5]\d)$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  const bare = text.match(/^\d+(\.\d+)?$/);
  if (bare) return Math.round(Number(text) * 60) || null;

  const units = text.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/);
  if (!units || (!units[1] && !units[2])) return null;
  const minutes =
    Math.round(Number(units[1] ?? 0) * 60) + Number(units[2] ?? 0);
  return minutes > 0 ? minutes : null;
}

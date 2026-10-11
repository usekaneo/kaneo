type DateInput = string | Date;

export function importRunMinutes(
  createdAt: DateInput,
  finishedAt: DateInput | null,
): number | null {
  if (!finishedAt) return null;

  const elapsed =
    new Date(finishedAt).getTime() - new Date(createdAt).getTime();
  if (!Number.isFinite(elapsed)) return null;

  return Math.max(0, Math.round(elapsed / 60_000));
}

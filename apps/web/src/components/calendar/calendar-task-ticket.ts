type TicketSource = {
  number: number | null;
  projectSlug?: string | null;
};

export function calendarTaskTicket(
  task: TicketSource,
  fallbackProjectSlug?: string,
): string | undefined {
  const slug = task.projectSlug ?? fallbackProjectSlug;
  if (!slug || task.number == null) return undefined;
  return `${slug}-${task.number}`;
}

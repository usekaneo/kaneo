export function setSubjectNegated(
  negated: string[] | null | undefined,
  subject: string,
  on: boolean,
): string[] | null {
  const rest = (negated ?? []).filter((item) => item !== subject);
  const next = on ? [...rest, subject] : rest;
  return next.length > 0 ? next : null;
}

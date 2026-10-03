// Fills i18next-style {{placeholders}}, so the preview reuses the app's copy.
export function fillMessage(
  template: string,
  values: Record<string, string | number>,
) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export function pluralMessage(
  messages: { one: string; other: string },
  count: number,
) {
  return fillMessage(count === 1 ? messages.one : messages.other, { count });
}

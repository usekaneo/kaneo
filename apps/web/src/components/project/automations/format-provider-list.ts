export function formatProviderList(names: string[], locale?: string) {
  try {
    return new Intl.ListFormat(locale, {
      style: "long",
      type: "disjunction",
    }).format(names);
  } catch {
    return names.join(", ");
  }
}

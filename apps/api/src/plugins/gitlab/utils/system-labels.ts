export function isSystemLabelName(name: string) {
  return name.startsWith("priority:") || name.startsWith("status:");
}

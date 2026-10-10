export type OfficialToggles = Readonly<Partial<Record<string, boolean>>>;

export function selectOfficialPlugins<T extends { id: string }>(
  plugins: readonly T[],
  toggles: OfficialToggles,
): T[] {
  return plugins.filter((plugin) => toggles[plugin.id] !== false);
}

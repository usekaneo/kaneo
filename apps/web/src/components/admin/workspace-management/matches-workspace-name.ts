/** Whether the typed confirmation names the workspace exactly. */
export function matchesWorkspaceName(typed: string, name: string) {
  const expected = name.trim();
  return expected !== "" && typed.trim() === expected;
}

export function toggleProjectId(
  projectIds: string[],
  projectId: string,
  checked: boolean,
): string[] {
  const rest = projectIds.filter((id) => id !== projectId);
  return checked ? [...rest, projectId] : rest;
}

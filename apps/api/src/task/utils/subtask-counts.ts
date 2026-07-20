export function getBoardVisibleSubtaskCounts(
  parentId: string,
  childrenMap: Map<string, string[]>,
  taskStatusMap: Map<string, string>,
  boardColumnSlugs: Set<string>,
  finalColumnSlugs: Set<string>,
): { directSubtaskCount: number; completedSubtaskCount: number } {
  const visibleChildren = (childrenMap.get(parentId) ?? []).filter(
    (childId) => {
      const status = taskStatusMap.get(childId);
      return status ? boardColumnSlugs.has(status) : false;
    },
  );

  return {
    directSubtaskCount: visibleChildren.length,
    completedSubtaskCount: visibleChildren.filter((childId) => {
      const status = taskStatusMap.get(childId);
      return status ? finalColumnSlugs.has(status) : false;
    }).length,
  };
}

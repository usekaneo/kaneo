/**
 * Per-viewer, per-project record of which list-view rows are expanded.
 *
 * This is a convenience rather than state the app depends on: a value that
 * cannot be read or written simply leaves every row collapsed.
 */
export function expandedRowsStorageKey(projectId: string) {
  return `kaneo:list-view:expanded-subtasks:${projectId}`;
}

export function readExpandedRows(projectId: string): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(expandedRowsStorageKey(projectId));
    if (!stored) return {};

    // A cast would let a stale or hand-edited value through: "null" parses
    // fine and then throws on the first property read, blanking the list.
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    const rows: Record<string, boolean> = {};
    for (const [rowId, value] of Object.entries(parsed)) {
      if (value === true) rows[rowId] = true;
    }
    return rows;
  } catch {
    return {};
  }
}

export function writeExpandedRows(
  projectId: string,
  rows: Record<string, boolean>,
) {
  try {
    localStorage.setItem(
      expandedRowsStorageKey(projectId),
      JSON.stringify(rows),
    );
  } catch {
    // A private window or blocked site data only costs the restore.
  }
}

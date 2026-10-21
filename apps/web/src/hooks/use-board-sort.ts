import { MANUAL_SORT, normalizeSort } from "@/lib/task-sort-config";
import { useStoredState } from "./use-stored-state";

export function useBoardSort(
  projectId: string | undefined,
  scope: "board" | "backlog" = "board",
) {
  const [sort, setSort] = useStoredState(
    projectId ? `kaneo:${scope}-sort:${projectId}` : null,
    normalizeSort,
    MANUAL_SORT,
  );
  return { sort, setSort };
}

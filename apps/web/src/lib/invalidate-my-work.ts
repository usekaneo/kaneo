import type { QueryClient } from "@tanstack/react-query";

// The sidebar count, Home, My tasks and the global board read tasks across
// projects, so any task change can move them even though no board cache does.
export function invalidateMyWork(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["assigned-tasks"] });
  void queryClient.invalidateQueries({ queryKey: ["workspace-activity"] });
  void queryClient.invalidateQueries({ queryKey: ["global-board", "tasks"] });
}

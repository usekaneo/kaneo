import type { QueryClient } from "@tanstack/react-query";

// The sidebar count, Home and My tasks read the caller's assigned tasks across
// projects, so any task change can move them even though no board cache does.
// Workspace calendar reads scheduled tasks the same way.
export function invalidateMyWork(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ["assigned-tasks"] });
  void queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
  void queryClient.invalidateQueries({ queryKey: ["workspace-activity"] });
}

import { useStoredState } from "@/hooks/use-stored-state";
import {
  DEFAULT_SPRINT_SCOPE,
  normalizeSprintScope,
  type SprintScope,
} from "./sprint-scope";

// The board sprint scope is remembered per project, so the board reopens with
// the sprint slice the user last looked at.
export function useSprintScope(projectId: string) {
  const [scope, setScope] = useStoredState<SprintScope>(
    `kaneo:board-sprint-scope:${projectId}`,
    normalizeSprintScope,
    DEFAULT_SPRINT_SCOPE,
  );
  return [scope, setScope] as const;
}

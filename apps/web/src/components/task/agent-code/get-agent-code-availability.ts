import type { AgentCodeRepository, AgentCodeStatus } from "@/types/agent";

export type AgentCodeAvailability =
  | { state: "hidden" }
  | { state: "unavailable" }
  | { state: "ready"; repositories: AgentCodeRepository[] };

// Hidden unless coding jobs are configured, the user may run them, and the
// task's project has an opted-in repository; disabled while none is ready.
export function getAgentCodeAvailability(
  status: AgentCodeStatus | undefined,
  repositories: AgentCodeRepository[] | undefined,
  projectId: string,
): AgentCodeAvailability {
  if (!status?.enabled || !status.canRunCode || !repositories)
    return { state: "hidden" };
  const projectRepositories = repositories.filter(
    (repository) => repository.projectId === projectId,
  );
  if (projectRepositories.length === 0) return { state: "hidden" };
  const ready = projectRepositories.filter(
    (repository) => repository.state === "ready",
  );
  return ready.length > 0
    ? { state: "ready", repositories: ready }
    : { state: "unavailable" };
}

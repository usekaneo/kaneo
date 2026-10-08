import { Option } from "effect";
import type { WorkspaceRef } from "../../services/session.js";

export function overrideNotice(
  current: Option.Option<WorkspaceRef>,
  repoPath: string | undefined,
  chosenId: string,
): string | null {
  if (Option.isNone(current)) return null;
  const { id, source } = current.value;
  if (source === "profile" || id === chosenId) return null;
  if (source === "flag") {
    return "-w overrides this default for the commands you pass it to.";
  }
  if (source === "env") {
    return "KANEO_WORKSPACE is set and is used instead of this default until you unset it.";
  }
  return `${repoPath ?? ".kaneo.json"} sets another workspace, which is used instead inside that folder.`;
}

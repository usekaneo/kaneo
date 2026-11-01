const PHASES: Record<string, string> = {
  starting: "starting",
  working: "working",
  testing: "testing",
  collecting: "collecting",
  opening_pr: "openingPr",
};

// Coarse progress phases reported while a job is active; unknown phases are
// hidden rather than shown raw.
export function getCodeJobPhaseKey(phase: string | null) {
  const key = phase ? PHASES[phase] : undefined;
  return key ? `agent:code.phase.${key}` : null;
}

const INSTRUCTIONS_MAX_LENGTH = 8000;

// The job only receives these instructions, so start from the task itself.
export function draftAgentCodeInstructions(task: {
  title: string;
  description?: string | null;
}) {
  return [task.title, task.description ?? ""]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, INSTRUCTIONS_MAX_LENGTH);
}

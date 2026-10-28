import { HttpError } from "@/lib/http-error";
import { getAgentErrorKey } from "../get-agent-error-key";

const SKIP_REASON_KEYS: Record<string, string> = {
  budget: "agent:automations.errors.budget",
  daily_limit: "agent:automations.errors.dailyLimit",
  overlap: "agent:automations.errors.overlap",
  unavailable: "agent:automations.errors.unavailable",
};

// Automation endpoints reuse agent statuses, plus a few specific messages.
export function getAutomationErrorKey(error: unknown) {
  if (error instanceof HttpError) {
    const message = error.message;
    if (error.status === 429) {
      const reason = /Automation run skipped: (\w+)/.exec(message)?.[1];
      if (reason && SKIP_REASON_KEYS[reason]) return SKIP_REASON_KEYS[reason];
      if (message.includes("Automation limit reached"))
        return "agent:automations.errors.limit";
    }
    if (error.status === 409) {
      if (message.includes("Enable the automation"))
        return "agent:automations.errors.disabled";
      if (message.includes("owner changed"))
        return "agent:automations.errors.ownerChanged";
    }
    if (error.status === 400 && message.includes("Model is not available"))
      return "agent:automations.errors.model";
    if (error.status === 400) return "agent:automations.errors.invalid";
  }
  return getAgentErrorKey(error);
}

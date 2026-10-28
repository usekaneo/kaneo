import type { activityTable } from "../database/schema";
import type { AgentComment } from "./types";

type Activity = typeof activityTable.$inferSelect;

// Effects are stored as JSON, so comment timestamps travel as ISO strings.
export function toAgentComment(activity: Activity): AgentComment {
  return {
    ...activity,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  };
}

export function fromAgentComment(comment: AgentComment): Activity {
  return {
    ...comment,
    createdAt: new Date(comment.createdAt),
    updatedAt: new Date(comment.updatedAt),
  };
}

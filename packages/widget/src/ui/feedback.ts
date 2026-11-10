import type { FeedbackStatus } from "./types.js";

export const feedbackStatusLabels: Record<FeedbackStatus, string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In progress",
  shipped: "Shipped",
};

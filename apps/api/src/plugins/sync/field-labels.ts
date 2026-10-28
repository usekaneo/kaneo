import { issueLabelNames } from "./rules";

export const isFieldLabel = (name: string) =>
  name.startsWith("status:") || name.startsWith("priority:");

/**
 * Link metadata recording the status and priority labels Kaneo has accounted
 * for on the issue. Inbound label sync applies only labels added since.
 */
export const confirmedFieldLabels = (labels: unknown) => ({
  syncFieldLabels: issueLabelNames(labels).filter(isFieldLabel),
});

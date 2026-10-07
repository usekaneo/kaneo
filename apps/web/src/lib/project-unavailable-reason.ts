import { HttpError } from "./http-error";

export type ProjectUnavailableReason = "forbidden" | "notFound";

export function getProjectUnavailableReason(
  error: unknown,
): ProjectUnavailableReason | null {
  if (!(error instanceof HttpError)) return null;
  if (error.status === 403) return "forbidden";
  if (error.status === 404) return "notFound";
  return null;
}

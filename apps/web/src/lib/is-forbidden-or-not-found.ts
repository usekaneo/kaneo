import { HttpError } from "./http-error";

export function isForbiddenOrNotFound(error: unknown): boolean {
  return (
    error instanceof HttpError && (error.status === 403 || error.status === 404)
  );
}

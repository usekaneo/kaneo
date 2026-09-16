export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof HttpError && error.status === 401;
}

// Shared unauthorized redirect for both the React Query error cache and direct
// fetcher calls (e.g. route loaders) that bypass the QueryCache. Stashes the
// current pathname/search/hash so the sign-in page can return the user to
// where they were instead of dropping them on /dashboard.
export function handleUnauthorized(): void {
  const currentPath =
    window.location.pathname + window.location.search + window.location.hash;
  const target = currentPath
    ? `/auth/sign-in?redirect=${encodeURIComponent(currentPath)}`
    : "/auth/sign-in";
  window.location.replace(target);
}

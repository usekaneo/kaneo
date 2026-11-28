import { HTTPException } from "hono/http-exception";
import type { RequestLease } from "../database/request-lease";
import { withRequestLease } from "../database/with-request-lease";

export const MAX_GITHUB_IMPORTS_IN_FLIGHT = 2;
let active = 0;

function busy() {
  return new HTTPException(429, {
    res: new Response("GitHub import is busy; retry this request", {
      status: 429,
      headers: { "Retry-After": "1" },
    }),
  });
}

export async function withGithubImportLock<T>(
  id: string,
  run: (lease: RequestLease) => Promise<T>,
): Promise<T> {
  if (active >= MAX_GITHUB_IMPORTS_IN_FLIGHT) throw busy();
  active++;
  try {
    return await withRequestLease(
      "github-import",
      id,
      MAX_GITHUB_IMPORTS_IN_FLIGHT,
      busy,
      run,
    );
  } finally {
    active--;
  }
}

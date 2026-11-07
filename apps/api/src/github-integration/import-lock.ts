import { HTTPException } from "hono/http-exception";
import { withLeaseSlots } from "../database/lease-slots";

export const MAX_GITHUB_IMPORTS_IN_FLIGHT = 2;
export const GITHUB_IMPORT_LEASE = "github-import";
let active = 0;

function busy() {
  return new HTTPException(429, {
    res: new Response("GitHub import is busy; retry this request", {
      status: 429,
      headers: { "Retry-After": "1" },
    }),
  });
}

/** Row leases span awaited provider calls without holding a connection. */
export async function withGithubImportLock<T>(
  id: string,
  run: () => Promise<T>,
): Promise<T> {
  if (active >= MAX_GITHUB_IMPORTS_IN_FLIGHT) throw busy();
  active++;
  try {
    return await withLeaseSlots(
      {
        prefix: GITHUB_IMPORT_LEASE,
        slots: MAX_GITHUB_IMPORTS_IN_FLIGHT,
        key: id,
        busy,
      },
      run,
    );
  } finally {
    active--;
  }
}

import { HTTPException } from "hono/http-exception";
import type { RequestLease } from "../database/request-lease";
import { withRequestLease } from "../database/with-request-lease";

export const MAX_LABEL_DELETIONS_IN_FLIGHT = 4;
let active = 0;

function busy() {
  return new HTTPException(429, {
    res: new Response("Label deletion is busy; retry this request", {
      status: 429,
      headers: { "Retry-After": "1" },
    }),
  });
}

export async function withLabelDeletionLock<T>(
  id: string,
  run: (lease: RequestLease) => Promise<T>,
): Promise<T> {
  if (active >= MAX_LABEL_DELETIONS_IN_FLIGHT) throw busy();
  active++;
  try {
    return await withRequestLease(
      "label-delete",
      id,
      MAX_LABEL_DELETIONS_IN_FLIGHT,
      busy,
      run,
    );
  } finally {
    active--;
  }
}

import { HTTPException } from "hono/http-exception";
import { withLeaseSlots } from "../database/lease-slots";

export const MAX_LABEL_DELETIONS_IN_FLIGHT = 4;
export const LABEL_DELETION_LEASE = "label-deletion";
let active = 0;

function busy() {
  return new HTTPException(429, {
    res: new Response("Label deletion is busy; retry this request", {
      status: 429,
      headers: { "Retry-After": "1" },
    }),
  });
}

/** Row leases span awaited provider calls without holding a connection. */
export async function withLabelDeletionLock<T>(
  id: string,
  run: () => Promise<T>,
): Promise<T> {
  if (active >= MAX_LABEL_DELETIONS_IN_FLIGHT) throw busy();
  active++;
  try {
    return await withLeaseSlots(
      {
        prefix: LABEL_DELETION_LEASE,
        slots: MAX_LABEL_DELETIONS_IN_FLIGHT,
        key: id,
        busy,
      },
      run,
    );
  } finally {
    active--;
  }
}

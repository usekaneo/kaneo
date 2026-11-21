import { sql } from "drizzle-orm";
import db from ".";
import { REQUEST_LEASE_MS } from "./request-lease";

export async function claimRequestLease(
  resource: string,
  slots: string[],
  owner: string,
  busy: () => Error,
): Promise<string[]> {
  return db.transaction(async (tx) => {
    const claim = async (name: string) => {
      const result = await tx.execute(sql`
        INSERT INTO job_lease (name, owner, expires_at)
        VALUES (${name}, ${owner}, timezone('UTC', clock_timestamp()) + ${REQUEST_LEASE_MS} * interval '1 millisecond')
        ON CONFLICT (name) DO UPDATE
          SET owner = EXCLUDED.owner, expires_at = EXCLUDED.expires_at
          WHERE job_lease.expires_at < timezone('UTC', clock_timestamp())
        RETURNING name
      `);
      return result.rowCount === 1;
    };
    if (!(await claim(resource))) throw busy();
    for (const slot of slots) {
      if (await claim(slot)) return [resource, slot];
    }
    // Roll back the resource claim too when every slot is occupied.
    throw busy();
  });
}

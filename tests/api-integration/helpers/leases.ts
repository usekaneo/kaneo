import { like } from "drizzle-orm";
import db, { schema } from "../../../apps/api/src/database";
import { slotLeaseName } from "../../../apps/api/src/database/lease-slots";

/** Holds slots the way another API instance would: live job_lease rows. */
export async function holdLeaseSlots(prefix: string, count: number) {
  await db.insert(schema.jobLeaseTable).values(
    Array.from({ length: count }, (_, slot) => ({
      name: slotLeaseName(prefix, slot),
      owner: "other-instance",
      expiresAt: new Date(Date.now() + 15 * 60_000),
    })),
  );
}

export async function releaseLeaseSlots(prefix: string) {
  await db
    .delete(schema.jobLeaseTable)
    .where(like(schema.jobLeaseTable.name, `${prefix}:slot:%`));
}

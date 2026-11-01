import { and, eq, lt } from "drizzle-orm";
import db, { getDatabasePool, schema } from "../src/database";

// Operator-only audit list. No prompts, attachments, credentials, or user emails.
try {
  const reservations = await db
    .select({
      id: schema.aiReservationTable.id,
      workspaceId: schema.aiReservationTable.workspaceId,
      runId: schema.aiReservationTable.runId,
      model: schema.aiReservationTable.model,
      reservedMicroUsd: schema.aiReservationTable.amount,
      generationId: schema.aiReservationTable.generationId,
      createdAt: schema.aiReservationTable.createdAt,
    })
    .from(schema.aiReservationTable)
    .where(
      and(
        eq(schema.aiReservationTable.status, "held"),
        lt(schema.aiReservationTable.createdAt, new Date(Date.now() - 600000)),
      ),
    )
    .orderBy(schema.aiReservationTable.createdAt)
    .limit(100);
  console.log(
    JSON.stringify(
      reservations.map((row) => ({
        ...row,
        reservedMicroUsd: row.reservedMicroUsd.toString(),
      })),
      null,
      2,
    ),
  );
} finally {
  await getDatabasePool().end();
}

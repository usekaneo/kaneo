import { eq } from "drizzle-orm";
import db from "../../database";
import { sessionTable } from "../../database/schema";

async function invalidateSession(sessionId: string) {
  await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
}

export default invalidateSession;

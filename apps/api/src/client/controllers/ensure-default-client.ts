import { and, eq } from "drizzle-orm";
import db from "../../database";
import { clientTable } from "../../database/schema";

export const DEFAULT_CLIENT_NAME = "Cliente padrão";
export const DEFAULT_CLIENT_CNPJ = "00000000000191";

async function ensureDefaultClient(workspaceId: string) {
  const [existing] = await db
    .select()
    .from(clientTable)
    .where(
      and(
        eq(clientTable.workspaceId, workspaceId),
        eq(clientTable.cnpj, DEFAULT_CLIENT_CNPJ),
      ),
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  try {
    const [created] = await db
      .insert(clientTable)
      .values({
        workspaceId,
        name: DEFAULT_CLIENT_NAME,
        cnpj: DEFAULT_CLIENT_CNPJ,
      })
      .returning();

    return created;
  } catch {
    const [fallback] = await db
      .select()
      .from(clientTable)
      .where(
        and(
          eq(clientTable.workspaceId, workspaceId),
          eq(clientTable.cnpj, DEFAULT_CLIENT_CNPJ),
        ),
      )
      .limit(1);

    if (!fallback) {
      throw new Error("Failed to ensure default client");
    }

    return fallback;
  }
}

export default ensureDefaultClient;

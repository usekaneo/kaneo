import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { clientTable } from "../../database/schema";

function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

async function createClient({
  workspaceId,
  name,
  tradeName,
  cnpj,
  email,
  phone,
  notes,
}: {
  workspaceId: string;
  name: string;
  tradeName?: string | null;
  cnpj: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}) {
  const normalizedCnpj = normalizeCnpj(cnpj);
  if (normalizedCnpj.length !== 14) {
    throw new HTTPException(400, { message: "CNPJ must have 14 digits" });
  }

  const [existing] = await db
    .select({ id: clientTable.id })
    .from(clientTable)
    .where(
      and(
        eq(clientTable.workspaceId, workspaceId),
        eq(clientTable.cnpj, normalizedCnpj),
      ),
    )
    .limit(1);

  if (existing) {
    throw new HTTPException(409, {
      message: "A client with this CNPJ already exists in the workspace",
    });
  }

  const [created] = await db
    .insert(clientTable)
    .values({
      workspaceId,
      name: name.trim(),
      tradeName: tradeName?.trim() || null,
      cnpj: normalizedCnpj,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      notes: notes?.trim() || null,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, { message: "Failed to create client" });
  }

  return created;
}

export default createClient;

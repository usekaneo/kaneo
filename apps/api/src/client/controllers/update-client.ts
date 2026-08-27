import { and, eq, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { clientTable } from "../../database/schema";
import type { ClientAddressInput } from "./create-client";

function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function updateClient({
  id,
  workspaceId,
  name,
  tradeName,
  cnpj,
  email,
  phone,
  notes,
  street,
  number,
  complement,
  neighborhood,
  city,
  state,
  zipCode,
  country,
}: {
  id: string;
  workspaceId: string;
  name?: string;
  tradeName?: string | null;
  cnpj?: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
} & ClientAddressInput) {
  const [existing] = await db
    .select()
    .from(clientTable)
    .where(eq(clientTable.id, id))
    .limit(1);

  if (!existing || existing.workspaceId !== workspaceId) {
    throw new HTTPException(404, { message: "Client not found" });
  }

  let normalizedCnpj = existing.cnpj;
  if (cnpj !== undefined) {
    normalizedCnpj = normalizeCnpj(cnpj);
    if (normalizedCnpj.length !== 14) {
      throw new HTTPException(400, { message: "CNPJ must have 14 digits" });
    }

    const [duplicate] = await db
      .select({ id: clientTable.id })
      .from(clientTable)
      .where(
        and(
          eq(clientTable.workspaceId, workspaceId),
          eq(clientTable.cnpj, normalizedCnpj),
          ne(clientTable.id, id),
        ),
      )
      .limit(1);

    if (duplicate) {
      throw new HTTPException(409, {
        message: "A client with this CNPJ already exists in the workspace",
      });
    }
  }

  const [updated] = await db
    .update(clientTable)
    .set({
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(tradeName !== undefined
        ? { tradeName: normalizeOptionalText(tradeName) }
        : {}),
      ...(cnpj !== undefined ? { cnpj: normalizedCnpj } : {}),
      ...(email !== undefined ? { email: normalizeOptionalText(email) } : {}),
      ...(phone !== undefined ? { phone: normalizeOptionalText(phone) } : {}),
      ...(notes !== undefined ? { notes: normalizeOptionalText(notes) } : {}),
      ...(street !== undefined
        ? { street: normalizeOptionalText(street) }
        : {}),
      ...(number !== undefined
        ? { number: normalizeOptionalText(number) }
        : {}),
      ...(complement !== undefined
        ? { complement: normalizeOptionalText(complement) }
        : {}),
      ...(neighborhood !== undefined
        ? { neighborhood: normalizeOptionalText(neighborhood) }
        : {}),
      ...(city !== undefined ? { city: normalizeOptionalText(city) } : {}),
      ...(state !== undefined
        ? { state: normalizeOptionalText(state)?.toUpperCase() ?? null }
        : {}),
      ...(zipCode !== undefined
        ? { zipCode: zipCode?.replace(/\D/g, "") || null }
        : {}),
      ...(country !== undefined
        ? { country: normalizeOptionalText(country) ?? "BR" }
        : {}),
    })
    .where(eq(clientTable.id, id))
    .returning();

  if (!updated) {
    throw new HTTPException(500, { message: "Failed to update client" });
  }

  return updated;
}

export default updateClient;

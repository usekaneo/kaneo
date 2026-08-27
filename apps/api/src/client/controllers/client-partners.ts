import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { clientPartnerTable, clientTable } from "../../database/schema";
import type { ClientPartnerInput } from "./create-client";

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeCpf(cpf?: string | null) {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, "");
  return digits || null;
}

async function assertClientInWorkspace(clientId: string, workspaceId: string) {
  const [client] = await db
    .select({ id: clientTable.id, workspaceId: clientTable.workspaceId })
    .from(clientTable)
    .where(eq(clientTable.id, clientId))
    .limit(1);

  if (!client || client.workspaceId !== workspaceId) {
    throw new HTTPException(404, { message: "Client not found" });
  }
}

export async function listClientPartners(
  clientId: string,
  workspaceId: string,
) {
  await assertClientInWorkspace(clientId, workspaceId);

  return db
    .select()
    .from(clientPartnerTable)
    .where(eq(clientPartnerTable.clientId, clientId))
    .orderBy(asc(clientPartnerTable.sortOrder), asc(clientPartnerTable.name));
}

export async function createClientPartner({
  clientId,
  workspaceId,
  partner,
}: {
  clientId: string;
  workspaceId: string;
  partner: ClientPartnerInput;
}) {
  await assertClientInWorkspace(clientId, workspaceId);

  const name = partner.name.trim();
  if (!name) {
    throw new HTTPException(400, { message: "Partner name is required" });
  }

  const [created] = await db
    .insert(clientPartnerTable)
    .values({
      clientId,
      name,
      cpf: normalizeCpf(partner.cpf),
      role: normalizeOptionalText(partner.role),
      ownershipPercent: partner.ownershipPercent ?? null,
      email: normalizeOptionalText(partner.email),
      phone: normalizeOptionalText(partner.phone),
      sortOrder: partner.sortOrder ?? 0,
    })
    .returning();

  if (!created) {
    throw new HTTPException(500, { message: "Failed to create partner" });
  }

  return created;
}

export async function updateClientPartner({
  partnerId,
  clientId,
  workspaceId,
  partner,
}: {
  partnerId: string;
  clientId: string;
  workspaceId: string;
  partner: Partial<ClientPartnerInput>;
}) {
  await assertClientInWorkspace(clientId, workspaceId);

  const [existing] = await db
    .select()
    .from(clientPartnerTable)
    .where(eq(clientPartnerTable.id, partnerId))
    .limit(1);

  if (!existing || existing.clientId !== clientId) {
    throw new HTTPException(404, { message: "Partner not found" });
  }

  const [updated] = await db
    .update(clientPartnerTable)
    .set({
      ...(partner.name !== undefined ? { name: partner.name.trim() } : {}),
      ...(partner.cpf !== undefined ? { cpf: normalizeCpf(partner.cpf) } : {}),
      ...(partner.role !== undefined
        ? { role: normalizeOptionalText(partner.role) }
        : {}),
      ...(partner.ownershipPercent !== undefined
        ? { ownershipPercent: partner.ownershipPercent }
        : {}),
      ...(partner.email !== undefined
        ? { email: normalizeOptionalText(partner.email) }
        : {}),
      ...(partner.phone !== undefined
        ? { phone: normalizeOptionalText(partner.phone) }
        : {}),
      ...(partner.sortOrder !== undefined
        ? { sortOrder: partner.sortOrder }
        : {}),
    })
    .where(eq(clientPartnerTable.id, partnerId))
    .returning();

  if (!updated) {
    throw new HTTPException(500, { message: "Failed to update partner" });
  }

  return updated;
}

export async function deleteClientPartner({
  partnerId,
  clientId,
  workspaceId,
}: {
  partnerId: string;
  clientId: string;
  workspaceId: string;
}) {
  await assertClientInWorkspace(clientId, workspaceId);

  const [existing] = await db
    .select()
    .from(clientPartnerTable)
    .where(eq(clientPartnerTable.id, partnerId))
    .limit(1);

  if (!existing || existing.clientId !== clientId) {
    throw new HTTPException(404, { message: "Partner not found" });
  }

  await db
    .delete(clientPartnerTable)
    .where(eq(clientPartnerTable.id, partnerId));

  return { success: true as const };
}

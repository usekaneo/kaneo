import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { clientPartnerTable, clientTable } from "../../database/schema";

function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

export type ClientAddressInput = {
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
};

export type ClientPartnerInput = {
  name: string;
  cpf?: string | null;
  role?: string | null;
  ownershipPercent?: number | null;
  email?: string | null;
  phone?: string | null;
  sortOrder?: number;
};

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeCpf(cpf?: string | null) {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, "");
  return digits || null;
}

async function createClient({
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
  partners,
}: {
  workspaceId: string;
  name: string;
  tradeName?: string | null;
  cnpj: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  partners?: ClientPartnerInput[];
} & ClientAddressInput) {
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

  const created = await db.transaction(async (tx) => {
    const [client] = await tx
      .insert(clientTable)
      .values({
        workspaceId,
        name: name.trim(),
        tradeName: normalizeOptionalText(tradeName),
        cnpj: normalizedCnpj,
        email: normalizeOptionalText(email),
        phone: normalizeOptionalText(phone),
        notes: normalizeOptionalText(notes),
        street: normalizeOptionalText(street),
        number: normalizeOptionalText(number),
        complement: normalizeOptionalText(complement),
        neighborhood: normalizeOptionalText(neighborhood),
        city: normalizeOptionalText(city),
        state: normalizeOptionalText(state)?.toUpperCase() ?? null,
        zipCode: zipCode?.replace(/\D/g, "") || null,
        country: normalizeOptionalText(country) ?? "BR",
      })
      .returning();

    if (!client) {
      throw new HTTPException(500, { message: "Failed to create client" });
    }

    const partnerRows = (partners ?? [])
      .map((partner, index) => ({
        clientId: client.id,
        name: partner.name.trim(),
        cpf: normalizeCpf(partner.cpf),
        role: normalizeOptionalText(partner.role),
        ownershipPercent: partner.ownershipPercent ?? null,
        email: normalizeOptionalText(partner.email),
        phone: normalizeOptionalText(partner.phone),
        sortOrder: partner.sortOrder ?? index,
      }))
      .filter((partner) => partner.name.length > 0);

    if (partnerRows.length > 0) {
      await tx.insert(clientPartnerTable).values(partnerRows);
    }

    return client;
  });

  return created;
}

export default createClient;

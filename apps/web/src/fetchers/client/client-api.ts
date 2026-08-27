import { client } from "@kaneo/libs";
import { getApiUrl } from "@/fetchers/get-api-url";

export type ClientPartner = {
  id: string;
  clientId: string;
  name: string;
  cpf: string | null;
  role: string | null;
  ownershipPercent: number | null;
  email: string | null;
  phone: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ClientRecord = {
  id: string;
  workspaceId: string;
  name: string;
  tradeName: string | null;
  cnpj: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
  partners?: ClientPartner[];
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

export type CnpjLookupResult = {
  cnpj: string;
  name: string;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string;
};

export type CreateClientInput = {
  workspaceId: string;
  name: string;
  cnpj: string;
  tradeName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  partners?: ClientPartnerInput[];
} & ClientAddressInput;

export type UpdateClientInput = {
  workspaceId: string;
  name?: string;
  cnpj?: string;
  tradeName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
} & ClientAddressInput;

export async function getClients(workspaceId: string) {
  const response = await client.client.$get({
    query: { workspaceId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<ClientRecord[]>;
}

export async function getClient(id: string, workspaceId: string) {
  const response = await fetch(
    `${getApiUrl(`/client/${id}`)}?workspaceId=${encodeURIComponent(workspaceId)}`,
    { credentials: "include" },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<ClientRecord>;
}

export async function createClient(input: CreateClientInput) {
  const response = await client.client.$post({
    json: input,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<ClientRecord>;
}

export async function updateClient(id: string, input: UpdateClientInput) {
  const response = await client.client[":id"].$patch({
    param: { id },
    json: input,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<ClientRecord>;
}

export async function lookupCnpj(workspaceId: string, cnpj: string) {
  const response = await fetch(
    `${getApiUrl("/client/lookup-cnpj")}?workspaceId=${encodeURIComponent(workspaceId)}&cnpj=${encodeURIComponent(cnpj)}`,
    { credentials: "include" },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<CnpjLookupResult>;
}

export async function createClientPartner(
  clientId: string,
  input: { workspaceId: string } & ClientPartnerInput,
) {
  const response = await fetch(getApiUrl(`/client/${clientId}/partners`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<ClientPartner>;
}

export async function deleteClientPartner(
  clientId: string,
  partnerId: string,
  workspaceId: string,
) {
  const response = await fetch(
    `${getApiUrl(`/client/${clientId}/partners/${partnerId}`)}?workspaceId=${encodeURIComponent(workspaceId)}`,
    { method: "DELETE", credentials: "include" },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<{ success: boolean }>;
}

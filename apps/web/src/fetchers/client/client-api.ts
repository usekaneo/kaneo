import { client } from "@kaneo/libs";

export type ClientRecord = {
  id: string;
  workspaceId: string;
  name: string;
  tradeName: string | null;
  cnpj: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getClients(workspaceId: string) {
  const response = await client.client.$get({
    query: { workspaceId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<ClientRecord[]>;
}

export async function createClient(input: {
  workspaceId: string;
  name: string;
  cnpj: string;
  tradeName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}) {
  const response = await client.client.$post({
    json: input,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<ClientRecord>;
}

export async function updateClient(
  id: string,
  input: {
    workspaceId: string;
    name?: string;
    cnpj?: string;
    tradeName?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
  },
) {
  const response = await client.client[":id"].$patch({
    param: { id },
    json: input,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<ClientRecord>;
}

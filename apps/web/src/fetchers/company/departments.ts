import { client } from "@kaneo/libs";

export async function listDepartments(workspaceId: string) {
  const response = await client.company.departments.$get({
    query: { workspaceId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function createDepartment(workspaceId: string, name: string) {
  const response = await client.company.departments.$post({
    json: { workspaceId, name },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export async function deleteDepartment(workspaceId: string, id: string) {
  const response = await client.company.departments[":id"].$delete({
    param: { id },
    query: { workspaceId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

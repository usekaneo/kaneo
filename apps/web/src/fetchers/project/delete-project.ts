import { api } from "@kaneo/libs";

export default async function deleteProject({ id }: { id: string }) {
  const response = await api.project({ id }).delete();

  if (response.error) {
    throw new Error(response.error.value.message);
  }

  return response?.data;
}

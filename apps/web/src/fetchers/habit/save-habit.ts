import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function createHabit(name: string) {
  const response = await client.habit.$post({ json: { name } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function renameHabit({ id, name }: { id: string; name: string }) {
  const response = await client.habit[":id"].$put({
    param: { id },
    json: { name },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function deleteHabit(id: string) {
  const response = await client.habit[":id"].$delete({ param: { id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

import { client } from "@kaneo/libs";

export default async function deleteExternalLink({
  taskId,
  id,
}: {
  taskId: string;
  id: string;
}) {
  const response = await client["external-link"].task[":taskId"][":id"].$delete(
    { param: { taskId, id } },
  );
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

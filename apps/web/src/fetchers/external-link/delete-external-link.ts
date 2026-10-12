import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

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
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

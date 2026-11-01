import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getAiCredit(workspaceId: string) {
  const response = await client.billing[":workspaceId"].ai.$get({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

export async function buyAiCredit(
  workspaceId: string,
  cents: number,
  requestId: string,
) {
  const response = await client.billing[":workspaceId"].ai.topups.$post({
    param: { workspaceId },
    json: { cents, requestId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}

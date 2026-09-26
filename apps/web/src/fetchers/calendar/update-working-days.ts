import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function updateWorkingDays(workspaceId: string, workingDays: number) {
  const response = await client.calendar[":workspaceId"].$put({
    param: { workspaceId },
    json: { workingDays },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default updateWorkingDays;

import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getCalendar(workspaceId: string) {
  const response = await client.calendar[":workspaceId"].$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getCalendar;

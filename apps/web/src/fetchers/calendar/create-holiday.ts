import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function createHoliday(
  workspaceId: string,
  data: { date: string; name: string },
) {
  const response = await client.calendar[":workspaceId"].holidays.$post({
    param: { workspaceId },
    json: data,
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default createHoliday;

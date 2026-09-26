import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function deleteHoliday(workspaceId: string, holidayId: string) {
  const response = await client.calendar[":workspaceId"].holidays[
    ":holidayId"
  ].$delete({
    param: { workspaceId, holidayId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default deleteHoliday;

import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function getTaskByTicketId(ticketId: string, workspaceSlug: string) {
  const response = await client.task["by-ticket-id"][":ticketId"].$get({
    param: { ticketId },
    query: { workspaceSlug },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default getTaskByTicketId;

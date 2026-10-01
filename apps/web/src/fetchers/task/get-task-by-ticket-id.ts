import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

async function fetchTaskByTicketId(ticketId: string, workspaceId?: string) {
  const response = await client.task["by-ticket-id"][":ticketId"].$get({
    param: { ticketId },
    query: workspaceId ? { workspaceId } : {},
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

async function getTaskByTicketId(
  ticketId: string,
  activeWorkspaceId?: string | null,
) {
  if (activeWorkspaceId) {
    try {
      return await fetchTaskByTicketId(ticketId, activeWorkspaceId);
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 404)) throw error;
    }
  }

  return fetchTaskByTicketId(ticketId);
}

export default getTaskByTicketId;

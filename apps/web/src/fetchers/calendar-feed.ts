import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
import { getApiUrl } from "./get-api-url";

const endpoint = client["calendar-feed"].project[":projectId"];

export async function getCalendarFeeds(projectId: string) {
  const response = await endpoint.$get({ param: { projectId } });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}

export async function createCalendarFeed(
  projectId: string,
  labelIds: string[],
  timeZone: string,
) {
  const response = await endpoint.$post({
    param: { projectId },
    json: { labelIds, timeZone },
  });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}

export async function revokeCalendarFeed(projectId: string, id: string) {
  const response = await endpoint[":id"].$delete({ param: { projectId, id } });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  return response.json();
}

export function getCalendarFeedUrl(token: string) {
  return new URL(
    getApiUrl(`/calendar-feed/${encodeURIComponent(token)}/calendar.ics`),
    window.location.origin,
  ).href;
}

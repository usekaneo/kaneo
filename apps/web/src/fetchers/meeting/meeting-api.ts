import { getApiUrl } from "@/fetchers/get-api-url";

export type MeetingBooking = {
  id: string;
  taskId: string;
  kind: string;
  status: string;
  title: string | null;
  schedulingUrl: string | null;
  meetingUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getMeetingBooking(taskId: string) {
  const response = await fetch(getApiUrl(`/meeting/${taskId}`), {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<MeetingBooking | null>;
}

export async function createMeetingBooking(input: {
  workspaceId: string;
  taskId: string;
  title?: string;
  schedulingUrl: string;
}) {
  const response = await fetch(getApiUrl("/meeting"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<MeetingBooking>;
}

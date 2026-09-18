import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";

export type AttendanceStatus = InferResponseType<
  (typeof client)["attendance"]["status"]["$get"],
  200
>;
export type AttendanceDays = InferResponseType<
  (typeof client)["attendance"]["days"]["$get"],
  200
>;
export type AttendanceDay = AttendanceDays["days"][number];
export type TeamAttendance = InferResponseType<
  (typeof client)["attendance"]["team"]["$get"],
  200
>;
export type UpdateSessionRequest = InferRequestType<
  (typeof client)["attendance"]["sessions"][":id"]["$put"]
>["json"];
export type CreateSessionRequest = InferRequestType<
  (typeof client)["attendance"]["sessions"]["$post"]
>["json"];

async function unwrap<T>(response: {
  ok: boolean;
  text: () => Promise<string>;
  json: () => Promise<T>;
}) {
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      message = JSON.parse(text).message ?? text;
    } catch {}
    throw new Error(message);
  }
  return response.json();
}

export async function getAttendanceStatus(workspaceId: string) {
  return unwrap(
    await client.attendance.status.$get({ query: { workspaceId } }),
  );
}

export async function clockIn(workspaceId: string) {
  return unwrap(
    await client.attendance["clock-in"].$post({ json: { workspaceId } }),
  );
}

export async function clockOut(workspaceId: string) {
  return unwrap(
    await client.attendance["clock-out"].$post({ json: { workspaceId } }),
  );
}

export async function getAttendanceDays(query: {
  workspaceId: string;
  userId?: string;
  from: string;
  to: string;
}) {
  return unwrap(await client.attendance.days.$get({ query }));
}

export async function getTeamAttendance(workspaceId: string, day: string) {
  return unwrap(
    await client.attendance.team.$get({ query: { workspaceId, day } }),
  );
}

export async function createAttendanceSession(json: CreateSessionRequest) {
  return unwrap(await client.attendance.sessions.$post({ json }));
}

export async function updateAttendanceSession(
  id: string,
  json: UpdateSessionRequest,
) {
  return unwrap(
    await client.attendance.sessions[":id"].$put({ param: { id }, json }),
  );
}

export async function deleteAttendanceSession(workspaceId: string, id: string) {
  return unwrap(
    await client.attendance.sessions[":id"].$delete({
      param: { id },
      query: { workspaceId },
    }),
  );
}

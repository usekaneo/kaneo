import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";
export async function getQuillsLinks(
  workspaceId: string,
  offset = 0,
  limit = 100,
) {
  const res = await client.quills[":workspaceId"].links.$get({
    param: { workspaceId },
    query: { offset: String(offset), limit: String(limit) },
  });
  if (!res.ok) throw await HttpError.fromResponse(res);
  return res.json();
}
export async function getQuillsTeams(workspaceId: string) {
  const res = await client.quills[":workspaceId"].teams.$get({
    param: { workspaceId },
  });
  if (!res.ok) throw await HttpError.fromResponse(res);
  return res.json();
}
export async function bindQuillsTeam(
  workspaceId: string,
  kaneoTeamId: string,
  isDefault = false,
) {
  const res = await client.quills[":workspaceId"].teams.$post({
    param: { workspaceId },
    json: { kaneoTeamId, isDefault },
  });
  if (!res.ok) throw await HttpError.fromResponse(res);
  return res.json();
}
export async function changeQuillsBoardProject(
  workspaceId: string,
  boardId: string,
  projectId: string,
  linked: boolean,
) {
  const endpoint =
    client.quills[":workspaceId"].boards[":boardId"].projects[":projectId"];
  const input = { param: { workspaceId, boardId, projectId } };
  const res = await (linked ? endpoint.$put(input) : endpoint.$delete(input));
  if (!res.ok) throw await HttpError.fromResponse(res);
  return res.json();
}
export async function changeQuillsPostTask(
  workspaceId: string,
  postId: string,
  taskId: string,
  linked: boolean,
) {
  const endpoint =
    client.quills[":workspaceId"].posts[":postId"].tasks[":taskId"];
  const input = { param: { workspaceId, postId, taskId } };
  const res = await (linked ? endpoint.$put(input) : endpoint.$delete(input));
  if (!res.ok) throw await HttpError.fromResponse(res);
  return res.json();
}
export async function getQuillsJobs(workspaceId: string, before?: string) {
  const res = await client.quills[":workspaceId"].jobs.$get({
    param: { workspaceId },
    query: { before, limit: "50" },
  });
  if (!res.ok) throw await HttpError.fromResponse(res);
  return res.json();
}
export async function retryQuillsJob(workspaceId: string, jobId: string) {
  const res = await client.quills[":workspaceId"].jobs[":jobId"].retry.$post({
    param: { workspaceId, jobId },
  });
  if (!res.ok) throw await HttpError.fromResponse(res);
  return res.json();
}

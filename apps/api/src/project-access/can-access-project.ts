import { findInaccessibleProjectIds } from "./find-inaccessible-project-ids";

export async function canAccessProject(userId: string, projectId: string) {
  return (await findInaccessibleProjectIds(userId, [projectId])).length === 0;
}

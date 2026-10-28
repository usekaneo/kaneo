import { createProjectFixture, createWorkspaceMember } from "../fixtures";
import { addWorkspaceMember } from "./add-workspace-member";
import { createTaskFixture } from "./create-task-fixture";
import { restrictToProjects } from "./restrict-to-projects";

export async function createRestrictedWorkspace() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  const alpha = await createProjectFixture({
    workspaceId: workspace.id,
    name: "Alpha",
    slug: "alpha",
  });
  const beta = await createProjectFixture({
    workspaceId: workspace.id,
    name: "Beta",
    slug: "beta",
  });
  const restricted = await addWorkspaceMember(workspace.id);
  await restrictToProjects(workspace.id, restricted.id, [alpha.project.id]);

  const alphaTask = await createTaskFixture(
    alpha,
    "Visible alpha task",
    restricted.id,
  );
  const betaTask = await createTaskFixture(
    beta,
    "Hidden beta task",
    restricted.id,
  );

  return {
    owner,
    workspace,
    restricted,
    alpha: alpha.project,
    beta: beta.project,
    alphaTask,
    betaTask,
  };
}

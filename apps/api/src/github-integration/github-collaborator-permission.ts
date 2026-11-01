import type { Octokit } from "octokit";

/**
 * The linked account's permission on a repository, resolved by numeric
 * account ID so a renamed or reused login cannot stand in for it.
 */
export async function getLinkedGithubPermission(
  octokit: Pick<Octokit, "rest">,
  repository: { owner: string; name: string },
  accountId: number,
) {
  const { data: user } = await octokit.rest.users.getById({
    account_id: accountId,
  });
  if (user.id !== accountId) throw new Error("GitHub identity mismatch");
  const { data } = await octokit.rest.repos.getCollaboratorPermissionLevel({
    owner: repository.owner,
    repo: repository.name,
    username: user.login,
  });
  return data.permission;
}

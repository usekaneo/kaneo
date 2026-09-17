import { prNumber, REPO } from "./identity.mjs";

const DEFAULT_MODEL = "qwen/qwen3.8-flash";
const isCommand = (body) =>
  typeof body === "string" && body.trim() === "/peekareq";

export async function authorizeRequest(eventName, event, request) {
  const deny = (reason) => ({ allowed: false, reason });
  if (event.repository?.full_name !== REPO)
    return deny("Different repository.");
  if (eventName === "repository_dispatch") {
    if (
      event.action !== "peekareq" ||
      event.sender?.type !== "Bot" ||
      event.sender?.login !== "peekareq[bot]"
    )
      return deny("Unexpected dispatcher.");
    const id = event.client_payload?.comment_id;
    const number = prNumber(event.client_payload?.pr);
    if (!Number.isSafeInteger(id) || id <= 0)
      return deny("Invalid comment identity.");
    const comment = await request(`repos/${REPO}/issues/comments/${id}`);
    return authorizeRequest(
      "issue_comment",
      {
        repository: event.repository,
        action: "created",
        issue: { number, pull_request: {} },
        comment: { ...comment, id },
      },
      request,
    );
  }
  let number;
  let login;
  let model = DEFAULT_MODEL;
  if (eventName === "issue_comment") {
    if (
      event.action !== "created" ||
      !event.issue?.pull_request ||
      event.comment?.user?.type !== "User" ||
      !isCommand(event.comment?.body)
    )
      return deny("Not a new /peekareq command on a PR.");
    number = prNumber(event.issue.number);
    login = event.comment.user.login;
    if (!Number.isSafeInteger(event.comment.id) || event.comment.id <= 0)
      return deny("Invalid comment identity.");
    const current = await request(
      `repos/${REPO}/issues/comments/${event.comment.id}`,
    );
    if (
      current.user?.login !== login ||
      current.user?.type !== "User" ||
      current.issue_url !==
        `https://api.github.com/repos/${REPO}/issues/${number}` ||
      !isCommand(current.body)
    )
      return deny("Command comment changed.");
  } else if (eventName === "workflow_dispatch") {
    if (event.sender?.type !== "User")
      return deny("A human maintainer must request the run.");
    login = event.sender.login;
    number = prNumber(event.inputs?.pr);
    model = event.inputs?.model || DEFAULT_MODEL;
    if (
      typeof model !== "string" ||
      model.length > 150 ||
      !/^[a-z0-9_.:-]+\/[a-z0-9_.:-]+$/i.test(model)
    )
      return deny("Invalid model identifier.");
  } else return deny("Unsupported trigger.");
  if (typeof login !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(login))
    return deny("Invalid requester.");
  // Author association (MEMBER/COLLABORATOR/etc.) is not an authorization check.
  const access = await request(
    `repos/${REPO}/collaborators/${login}/permission`,
  );
  if (!["write", "maintain", "admin"].includes(access.permission))
    return deny("Write, maintain, or admin access is required.");
  const pr = await request(`repos/${REPO}/pulls/${number}`);
  if (pr.state !== "open" || pr.base?.repo?.full_name !== REPO)
    return deny("The command requires an open PR in this repository.");
  return { allowed: true, pr: number, model, reason: "Maintainer authorized." };
}

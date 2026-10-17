import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { GitHub } from "./github.mjs";
import { isMaintainer } from "./is-maintainer.mjs";
import { scanFiles } from "./scan.mjs";
import { publishScan } from "./publish.mjs";

export async function checkPullRequest(
  event,
  env,
  fetcher = fetch,
  scan = scanFiles,
) {
  const number =
    event.pull_request?.number ?? Number(event.inputs?.pull_request_number);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error("Invalid pull request number.");
  }
  const github = new GitHub(env, fetcher);
  const root = `/repos/${github.repository}/pulls/${number}`;
  const pull = await github.request(root);
  if (pull.state !== "open") return "closed";
  if (await isMaintainer(github, pull.user?.login)) return "maintainer";
  if (pull.changed_files > 3000) {
    throw new Error("GitHub cannot list every file in this pull request.");
  }
  const files = await github.list(`${root}/files`);
  if (files.length !== pull.changed_files) {
    throw new Error("GitHub did not return a complete pull request file list.");
  }
  const result = await scan(files, (file) =>
    github.source(file, pull.head.repo?.full_name),
  );
  return publishScan(github, pull, result);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const event = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
  );
  const status = await checkPullRequest(event, process.env);
  console.log(`AI-comment scan: ${status}.`);
}

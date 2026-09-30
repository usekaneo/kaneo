import { appendFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { command } from "./core.mjs";
import { authorizeRequest as authorize } from "./request-policy.mjs";

const api = async (endpoint) =>
  JSON.parse(await command("gh", ["api", endpoint]));
export const authorizeRequest = (
  name,
  event,
  request = api,
  command = "peekareq",
) => authorize(name, event, request, command);

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const event = JSON.parse(
      await readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
    );
    const result = await authorizeRequest(
      process.env.GITHUB_EVENT_NAME,
      event,
      api,
      process.env.REVIEW_COMMAND || "peekareq",
    );
    const output = `allowed=${result.allowed}\n${result.allowed ? `pr=${result.pr}\nmodel=${result.model}\n` : ""}`;
    await appendFile(process.env.GITHUB_OUTPUT, output);
    console.log(result.reason);
  } catch {
    console.error(
      "Unable to verify the request. No screenshot run was started.",
    );
    process.exitCode = 1;
  }
}

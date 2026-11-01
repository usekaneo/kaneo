import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
function gitEnvironment(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_ATTR_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
  };
}
export async function git(
  cwd: string,
  args: string[],
  env: NodeJS.ProcessEnv = gitEnvironment(),
) {
  return (
    await exec("git", ["-c", "core.hooksPath=/dev/null", ...args], {
      cwd,
      env,
      encoding: "buffer",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 30000,
    })
  ).stdout;
}

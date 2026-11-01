import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { afterEach, expect, it, vi } from "vite-plus/test";
vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
import { runOpencode } from "./opencode.js";

const spec = {
  jobId: "job",
  instructions: "Fix the bug",
  baseSha: "a".repeat(40),
  baseRef: "main",
  branch: "branch",
  repository: "acme/widget",
  model: "openai/test",
  deadline: new Date(Date.now() + 60000).toISOString(),
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it("keeps OIDC, callback, GitHub, and inherited credentials out of the coding process", async () => {
  vi.stubEnv("GITHUB_TOKEN", "write-token");
  vi.stubEnv("ACTIONS_ID_TOKEN_REQUEST_TOKEN", "oidc-secret");
  vi.stubEnv("KANEO_JOB_TOKEN", "callback-secret");
  vi.stubEnv("UNRELATED_SECRET", "secret");
  const child = Object.assign(new EventEmitter(), { pid: 12345 });
  vi.mocked(spawn).mockImplementation(() => {
    queueMicrotask(() => child.emit("exit", 0));
    return child as unknown as ReturnType<typeof spawn>;
  });
  await runOpencode("/tmp", spec, "model-secret", new AbortController().signal);
  const [binary, args, options] = vi.mocked(spawn).mock.calls[0]!;
  expect(binary).toMatch(/node_modules\/\.bin\/opencode$/);
  expect(args).toContain("openrouter/openai/test");
  expect(args).toContain("--pure");
  expect(options?.env).toMatchObject({
    OPENROUTER_API_KEY: "model-secret",
    OPENCODE_DISABLE_PROJECT_CONFIG: "true",
  });
  expect(options?.env).not.toHaveProperty("GITHUB_TOKEN");
  expect(options?.env).not.toHaveProperty("ACTIONS_ID_TOKEN_REQUEST_TOKEN");
  expect(options?.env).not.toHaveProperty("KANEO_JOB_TOKEN");
  expect(options?.env).not.toHaveProperty("UNRELATED_SECRET");
  expect(
    JSON.parse(String(options?.env?.OPENCODE_CONFIG_CONTENT)).permission,
  ).toMatchObject({
    bash: { "*": "deny" },
    webfetch: "deny",
    external_directory: "deny",
  });
});
it("kills the coding process group when its deadline or heartbeat aborts", async () => {
  const child = Object.assign(new EventEmitter(), { pid: 12345 });
  vi.mocked(spawn).mockReturnValue(
    child as unknown as ReturnType<typeof spawn>,
  );
  const kill = vi.spyOn(process, "kill").mockImplementation(() => {
    queueMicrotask(() => child.emit("exit", null));
    return true;
  });
  const controller = new AbortController();
  const result = runOpencode("/tmp", spec, "model-secret", controller.signal);
  const rejected = expect(result).rejects.toThrow("Coding agent failed");
  await vi.waitFor(() => expect(spawn).toHaveBeenCalled());
  controller.abort();
  await rejected;
  expect(kill).toHaveBeenCalledWith(-12345, "SIGKILL");
});

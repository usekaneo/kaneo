import { mkdtemp, writeFile, rm, unlink, mkdir, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { git } from "./git.js";
import { prepareChangeCollector } from "./prepare-change-collector.js";
import { runJob, type JobOptions } from "./run-job.js";

let cwd: string;
let baseSha: string;
let requests: {
  url: string;
  body: Record<string, unknown>;
  auth: string | null;
}[];
const credential = "c".repeat(43);
const spec = () => ({
  jobId: "job1",
  instructions: "Fix reconnect",
  context: "Untrusted task context",
  baseSha,
  baseRef: "main",
  branch: "web-1-kaneo-abcdef",
  repository: "acme/widget",
  model: "openai/test",
  deadline: new Date(Date.now() + 60000).toISOString(),
});
const options = (): JobOptions => ({
  apiUrl: "https://kaneo.example",
  jobId: "job1",
  cwd,
  modelKey: "test-model-key",
  oidcUrl: "https://oidc.example/token?x=y",
  oidcToken: "oidc-request-key",
  repository: "acme/widget",
});
const fetchMock: typeof fetch = vi.fn(async (input, init) => {
  const url = String(input);
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
  requests.push({
    url,
    body,
    auth: new Headers(init?.headers).get("Authorization"),
  });
  if (url.startsWith("https://oidc.example"))
    return Response.json({ value: "oidc-jwt" });
  if (url.endsWith("/claim"))
    return Response.json({ credential, spec: spec() });
  return Response.json({ accepted: true, cancelRequested: false });
});
beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "kaneo-wrapper-test-"));
  await git(cwd, ["init", "-b", "main"]);
  await git(cwd, ["config", "user.name", "Test"]);
  await git(cwd, ["config", "user.email", "test@example.com"]);
  await writeFile(join(cwd, "old.txt"), "old");
  await git(cwd, ["add", "."]);
  await git(cwd, ["commit", "-m", "initial"]);
  baseSha = (await git(cwd, ["rev-parse", "HEAD"])).toString().trim();
  requests = [];
});
afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe("CI job wrapper", () => {
  it("claims through OIDC, runs a mocked coding CLI, uploads file operations and masks secrets", async () => {
    const mask = vi.fn();
    const runAgent = vi.fn(async (_cwd, received) => {
      expect(received.instructions).toBe("Fix reconnect");
      await unlink(join(cwd, "old.txt"));
      await mkdir(join(cwd, "src"));
      await writeFile(join(cwd, "src/fix.ts"), "fixed");
    });
    await runJob(options(), { fetch: fetchMock, runAgent, mask });
    expect(runAgent).toHaveBeenCalledOnce();
    expect(mask).toHaveBeenCalledWith(credential);
    const upload = requests.find((request) =>
      request.url.endsWith("/changeset"),
    );
    expect(upload?.body).toMatchObject({
      outcome: "changes",
      baseSha,
      files: [
        { action: "delete", path: "old.txt" },
        {
          action: "upsert",
          path: "src/fix.ts",
          mode: "100644",
          content: Buffer.from("fixed").toString("base64"),
        },
      ],
    });
    expect(upload?.auth).toBe(`Bearer ${credential}`);
    expect(requests[0]?.url).toContain("audience=https%3A%2F%2Fkaneo.example");
    expect(
      JSON.stringify(requests.map((request) => request.body)),
    ).not.toContain("test-model-key");
  });
  it("reports no changes and handles CLI failure without sending its output", async () => {
    await runJob(options(), { fetch: fetchMock, runAgent: async () => {} });
    expect(
      requests.find((request) => request.url.endsWith("/changeset"))?.body,
    ).toMatchObject({ outcome: "no_changes" });
    requests = [];
    await expect(
      runJob(options(), {
        fetch: fetchMock,
        runAgent: async () => {
          throw new Error("secret-output");
        },
      }),
    ).rejects.toThrow("Kaneo coding job failed");
    expect(
      requests.find((request) => request.url.endsWith("/fail"))?.body,
    ).toEqual({ code: "agent_failed" });
    expect(JSON.stringify(requests)).not.toContain("secret-output");
  });
  it("does not execute clean filters written by the coding agent", async () => {
    const marker = join(cwd, ".git", "filter-executed");
    await runJob(options(), {
      fetch: fetchMock,
      runAgent: async () => {
        await writeFile(join(cwd, ".gitattributes"), "*.txt filter=probe\n");
        await writeFile(join(cwd, "old.txt"), "changed");
        await git(cwd, [
          "config",
          "filter.probe.clean",
          `touch '${marker.replaceAll("'", "'\\''")}'; cat`,
        ]);
      },
    });
    expect(existsSync(marker)).toBe(false);
    expect(
      requests.find((request) => request.url.endsWith("/changeset"))?.body,
    ).toMatchObject({
      files: expect.arrayContaining([
        expect.objectContaining({
          path: "old.txt",
          content: Buffer.from("changed").toString("base64"),
        }),
      ]),
    });
  });
  it("rejects a failed claim before running any coding CLI", async () => {
    const runAgent = vi.fn();
    await expect(
      runJob(options(), {
        fetch: async (input, init) =>
          String(input).endsWith("/claim")
            ? Response.json({}, { status: 403 })
            : fetchMock(input, init),
        runAgent,
      }),
    ).rejects.toThrow("Job claim rejected");
    expect(runAgent).not.toHaveBeenCalled();
  });
  it("collects binary files and executable mode using an isolated index", async () => {
    const collector = await prepareChangeCollector(cwd, baseSha);
    try {
      await writeFile(join(cwd, "binary"), Buffer.from([0, 255, 1]));
      await writeFile(join(cwd, "script"), "#!/bin/sh\n");
      await chmod(join(cwd, "script"), 0o755);
      const files = await collector.collect();
      expect(files).toContainEqual({
        action: "upsert",
        path: "binary",
        mode: "100644",
        content: "AP8B",
      });
      expect(files).toContainEqual(
        expect.objectContaining({ path: "script", mode: "100755" }),
      );
      expect((await git(cwd, ["diff", "--cached", "--name-only"])).length).toBe(
        0,
      );
    } finally {
      await collector.dispose();
    }
  });
  it("stops when a heartbeat rejects a cancelled job", async () => {
    vi.useFakeTimers();
    try {
      const controller = new AbortController();
      const runAgent = vi.fn(async (_cwd, _spec, _key, signal: AbortSignal) => {
        controller.abort();
        await new Promise<void>((_resolve, reject) =>
          signal.addEventListener(
            "abort",
            () => reject(new Error("cancelled")),
            { once: true },
          ),
        );
      });
      const job = runJob(options(), {
        fetch: async (input, init) =>
          String(input).endsWith("/heartbeat") && runAgent.mock.calls.length
            ? Response.json({}, { status: 410 })
            : fetchMock(input, init),
        runAgent,
      });
      const caught = expect(job).rejects.toThrow("Kaneo coding job failed");
      await vi.waitFor(() => expect(controller.signal.aborted).toBe(true));
      await vi.advanceTimersByTimeAsync(30000);
      await caught;
    } finally {
      vi.useRealTimers();
    }
  });
});

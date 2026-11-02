import { serve } from "@hono/node-server";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git } from "../../../../packages/agent-job/src/git";
import { runJob } from "../../../../packages/agent-job/src/run-job";
import type { JobSpec } from "../../../../packages/agent-job/src/protocol";
import { processCodeJobs } from "../../../../apps/api/src/agent/code/process-code-jobs";
import { mockAnonymousSession } from "../auth";
import { createCodingFixture } from "./create-coding-fixture";
import type { CodingGithubFixture } from "./github-fixture";

const realFetch = globalThis.fetch;

export async function createCodingHttpFixture(github: CodingGithubFixture) {
  const cwd = await mkdtemp(join(tmpdir(), "kaneo-coding-http-"));
  let server: ReturnType<typeof serve> | undefined;
  const close = async () => {
    if (server) {
      if ("closeAllConnections" in server) server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      );
    }
    await rm(cwd, { recursive: true, force: true });
  };
  try {
    await git(cwd, ["init", "-b", "main"]);
    await git(cwd, ["config", "user.name", "Test"]);
    await git(cwd, ["config", "user.email", "test@example.com"]);
    await writeFile(join(cwd, "old.txt"), "original\n");
    await git(cwd, ["add", "."]);
    await git(cwd, ["commit", "-m", "initial"]);
    github.baseSha = (await git(cwd, ["rev-parse", "HEAD"])).toString().trim();
    const ctx = await createCodingFixture(github);
    const response = await ctx.start();
    if (response.status !== 202) throw new Error("Job did not start");
    const job = await response.json();
    await processCodeJobs();
    mockAnonymousSession();
    const requests: { path: string; status: number }[] = [];
    server = serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: async (request) => {
        const path = new URL(request.url).pathname;
        if (path === "/test-oidc")
          return Response.json({ value: await ctx.oidc() });
        const result = await ctx.app.fetch(request);
        requests.push({ path, status: result.status });
        return result;
      },
    });
    if (!server.listening) await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("HTTP fixture did not bind a local port");
    const origin = `http://127.0.0.1:${address.port}`;
    let credential = "";
    return {
      ...ctx,
      cwd,
      job,
      requests,
      close,
      get credential() {
        return credential;
      },
      run: (
        runAgent: (
          cwd: string,
          spec: JobSpec,
          key: string,
          signal: AbortSignal,
        ) => Promise<void>,
      ) =>
        runJob(
          {
            apiUrl: origin,
            audience: "http://localhost:1337",
            jobId: job.id,
            cwd,
            modelKey: "fixture-model-key",
            oidcUrl: `${origin}/test-oidc`,
            oidcToken: "fixture-oidc-key",
            repository: "acme/widget",
          },
          {
            // Bypass the external GitHub stub for local wrapper HTTP requests.
            fetch: realFetch,
            runAgent,
            mask: (value) => {
              if (value !== "fixture-model-key") credential = value;
            },
          },
        ),
      request: (path: string, body: unknown, token: string) =>
        realFetch(`${origin}/api/agent-jobs/${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }),
    };
  } catch (error) {
    await close();
    throw error;
  }
}

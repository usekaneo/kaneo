import { generateKeyPairSync } from "node:crypto";
import { exportJWK } from "jose";
import { vi } from "vite-plus/test";

export function createCodingGithubFixture() {
  const github = {
    keys: generateKeyPairSync("rsa", { modulusLength: 2048 }),
    baseSha: "a".repeat(40),
    commitSha: "c".repeat(40),
    permission: "write",
    branchSha: undefined as string | undefined,
    pulls: [] as Record<string, unknown>[],
    calls: [] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
    }[],
    dispatches: 0,
    rejectPrOnce: false,
    ciCompleted: false,
    abortDispatch: undefined as AbortController | undefined,
    loseDispatchReply: false,
    rejectCancelOnce: false,
    visibleRuns: [] as {
      id: number;
      display_title: string;
      head_sha: string;
    }[],
    install() {
      Object.assign(github, {
        baseSha: "a".repeat(40),
        permission: "write",
        branchSha: undefined,
        pulls: [],
        calls: [],
        dispatches: 0,
        rejectPrOnce: false,
        ciCompleted: false,
        abortDispatch: undefined,
        loseDispatchReply: false,
        rejectCancelOnce: false,
        visibleRuns: [],
      });
      vi.stubEnv("KANEO_AGENT_ENABLED", "true");
      vi.stubEnv("OPENROUTER_API_KEY", "fake-model-key");
      vi.stubEnv("KANEO_AGENT_GITHUB_APP_ID", "90001");
      vi.stubEnv(
        "KANEO_AGENT_GITHUB_APP_PRIVATE_KEY",
        github.keys.privateKey
          .export({ type: "pkcs1", format: "pem" })
          .toString(),
      );
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
          const url = new URL(
            typeof input === "string" || input instanceof URL
              ? input
              : input.url,
          );
          if (url.origin === "https://token.actions.githubusercontent.com")
            return json({
              keys: [
                {
                  ...(await exportJWK(github.keys.publicKey)),
                  kid: "coding-test",
                  alg: "RS256",
                },
              ],
            });
          if (url.origin !== "https://api.github.com")
            throw new Error(`Unexpected outbound request: ${url.origin}`);
          const method = init?.method ?? "GET";
          const body =
            typeof init?.body === "string" ? JSON.parse(init.body) : {};
          github.calls.push({ method, path: url.pathname, body });
          const path = decodeURIComponent(url.pathname);
          if (path === "/repos/acme/widget/installation")
            return json({
              id: 22,
              permissions: {
                contents: "write",
                pull_requests: "write",
                actions: "write",
              },
            });
          if (path === "/app/installations/22/access_tokens")
            return json(
              {
                token: "fake-installation-token",
                expires_at: new Date(Date.now() + 3600000).toISOString(),
                permissions: {
                  contents: "write",
                  pull_requests: "write",
                  actions: "write",
                },
              },
              201,
            );
          if (path === "/repos/acme/widget")
            return json({
              id: 42,
              owner: { login: "acme" },
              name: "widget",
              default_branch: "main",
            });
          if (path === "/user/1001")
            return json({ id: 1001, login: "maintainer" });
          if (path.endsWith("/collaborators/maintainer/permission"))
            return json({ permission: github.permission });
          if (path.endsWith("/branches/main"))
            return json({ name: "main", commit: { sha: github.baseSha } });
          if (path.endsWith("/actions/workflows/kaneo-agent.yml/runs"))
            return json({
              total_count: github.visibleRuns.length,
              workflow_runs: github.visibleRuns.slice(
                (Number(url.searchParams.get("page") ?? 1) - 1) * 100,
                Number(url.searchParams.get("page") ?? 1) * 100,
              ),
            });
          if (path.endsWith("/actions/workflows/kaneo-agent.yml/dispatches")) {
            github.dispatches++;
            if (github.abortDispatch) {
              github.abortDispatch.abort();
              throw new Error("shutdown while dispatching");
            }
            if (github.loseDispatchReply)
              throw new Error("dispatch accepted but response lost");
            return json({
              workflow_run_id: 123,
              html_url: "https://github.com/acme/widget/actions/runs/123",
            });
          }
          if (path.endsWith("/actions/workflows/kaneo-agent.yml"))
            return json({ state: "active" });
          if (path.endsWith("/actions/runs/123/cancel")) {
            if (github.rejectCancelOnce) {
              github.rejectCancelOnce = false;
              return json({ message: "temporary cancellation failure" }, 503);
            }
            return new Response(null, { status: 202 });
          }
          if (path.endsWith("/actions/runs/123"))
            return json({
              status: github.ciCompleted ? "completed" : "in_progress",
            });
          if (path.endsWith(`/git/commits/${github.baseSha}`))
            return json({ tree: { sha: "tree-base" } });
          if (path.endsWith("/git/blobs")) return json({ sha: "blob" }, 201);
          if (path.endsWith("/git/trees"))
            return json({ sha: "tree-new" }, 201);
          if (path.endsWith("/git/commits"))
            return json({ sha: github.commitSha }, 201);
          if (path.includes("/git/ref/heads/"))
            return github.branchSha
              ? json({ object: { sha: github.branchSha } })
              : json({ message: "Not Found" }, 404);
          if (path.endsWith("/git/refs")) {
            github.branchSha = String(body.sha);
            return json({ object: { sha: github.branchSha } }, 201);
          }
          if (path.endsWith("/pulls") && method === "GET")
            return json(github.pulls);
          if (path.endsWith("/pulls") && method === "POST") {
            if (github.rejectPrOnce) {
              github.rejectPrOnce = false;
              return json({ message: "temporary" }, 503);
            }
            const pr = {
              number: 7,
              title: body.title,
              body: body.body,
              html_url: "https://github.com/acme/widget/pull/7",
              state: "open",
              draft: body.draft,
              head: { sha: github.commitSha, ref: body.head },
              base: { ref: body.base },
              user: { login: "kaneo-agent[bot]" },
            };
            github.pulls.push(pr);
            return json(pr, 201);
          }
          throw new Error(`Unexpected GitHub request: ${method} ${path}`);
        }),
      );
    },
  };
  const json = (data: unknown, status = 200) => Response.json(data, { status });
  return github;
}

export type CodingGithubFixture = ReturnType<typeof createCodingGithubFixture>;
